import { createClient } from '@sanity/client'
import {createImageUrlBuilder} from '@sanity/image-url'
import {ProductTypes} from '../../shared/enums.mjs';
import {
  PageMinimal,
  SanityOrderStatusHistoryItem,
  SanityUser,
  SanityOrderProductsVariantsVouchersShippings,
  SanityOrderMetaCreate,
  SanityOrderMetaUpdate,
  SanityOrderMetaGet,
  SanityOrderCreateResult,
  SanityOrderCreate,
  SanityOrderForClient,
  SanitySettings,
  SanitySettingsAndOrderByIdResult,
  Image,
  SanityInventoryResult,
} from '../server_types';
import { LocalizedString } from '../../shared/shared_types.mts';


if (!process.env.SANITY_STUDIO_PROJECT) {
  throw new Error("Missing SANITY_STUDIO_PROJECT");
}
if (!process.env.SANITY_TOKEN) {
  throw new Error("Missing SANITY_TOKEN");
}
if (!process.env.SANITY_STUDIO_DATASET) {
  throw new Error("Missing SANITY_STUDIO_DATASET");
}

export const sanity = createClient({
  projectId: process.env.SANITY_STUDIO_PROJECT,
  token: process.env.SANITY_TOKEN,
  dataset: process.env.SANITY_STUDIO_DATASET,
  apiVersion: sanityApiVersion,
  useCdn: false,
  perspective: 'published',
  maxRetries: 2,
  retryDelay: (attempt) => 1000 * 2 ** attempt
})

export const imageBuilder = createImageUrlBuilder(sanity)

export const sanityReplaceableImageUrl = (image: Image) => {
  if (!image) {
    return "";
  }
  const url = imageBuilder.image(image)
    .format("jpg")
    .width(500)
    .height(500)
    .url();
  
    // TODO: check if 500w replacement is needed
  const output = url
    .replace('w=500', 'w={width}')
    .replace('h=500', 'w={height}')
    .replace('fm=jpg', 'fm={format}')
    .replace('500w', '{width}w');

  return output;
}

export const fetchQuery = async (query: string, vars: Record<string, any>) => {
  return sanity.fetch(query, vars);
}

const imagePayload = `
  _type,
  "asset": asset->{url, _id, "dimensions": metadata.dimensions {width, height, aspectRatio}},
  crop,
  hotspot
`;

export const getProductsVariantsVouchersShippings = async ({
  withVariantOptions,
  productIds,
  variantIds,
  bundleIds,
  voucherCodes,
  voucherIds,
  userId,
}: {
  withVariantOptions: boolean,
  productIds: string[],
  variantIds: string[],
  bundleIds: string[],
  voucherCodes: string[],
  voucherIds: string[],
  userId?: string
}): Promise<SanityOrderProductsVariantsVouchersShippings> => {
  const productData = '_id,price,title,stock,productNumber,"categoryIds": categories[]._ref'
  const variantOptionsData = `
    options[]->{
      title,
      "group": *[_type == "variantOptionGroup" && references(^._id)][0].title
    }
  `
  const variantData = withVariantOptions ? `${productData},${variantOptionsData}` : productData
  const userOrderQuery = userId ? `"userOrderCount": count(*[_type == "order" && supabaseUserId == "${userId}"])` : undefined
  const userQuery = userId ? `"user": *[_type == "user" && externalUserId == "${userId}"][0]{_id,"customerGroupIds": customerGroups[]._ref}` : undefined
  const query = `{
    "products": *[_type == "product" && _id in $productIds] {${productData}},
    "variants": *[_type == "productVariant" && _id in $variantIds && active == true] {${variantData}},
    "vouchers": *[
      _type == "voucher" &&
      active == true &&
      (code in $voucherCodes || !defined(code) || _id in $voucherIds) &&
      (
        !defined(validFrom) || validFrom <= now()
      ) &&
      (
        !defined(validUntil) || validUntil >= now()
      )
    ] {
      _id,
      title,
      description,
      active,
      code,
      discountType,
      discountFixed,
      discountPercentage,
      stackable,
      validFrom,
      validUntil,
      "customerGroupIds": customerGroups[]._ref,
      conditions[]{
        type,
        ...select(
          type == "product" => {
            "productId": product->_id,
            "productTitle": product->title
          },
          type == "category" => {
            "categoryId": category->_id,
            "categoryTitle": category->title,
            minQuantity
          },
          type == "totalValue" => {
            minValue
          },
          type == "quantity" => {
            minQuantity,
            "productId": quantityProduct->_id,
            "productTitle": quantityProduct->title
          },
          type == "userStatus" => {
            "status": userStatus
          }
        )
      },
      rewards[] {
        "productId": product->_id,
        "productTitle": product->title,
        quantity,
        "productNumber": product->productNumber
      }
    },
    "shippingCountries": *[_type == "shippingCountry"] {
      _id,
      isDefault,
      title,
      code,
      taxRate,
      rates[]{
        _key,
        title,
        amount
      }
    }
    ${userOrderQuery ? `, ${userOrderQuery}` : ''}
    ${userQuery ? `, ${userQuery}` : ''}
  }`;
  const data = await fetchQuery(query, {
    productIds,
    variantIds,
    voucherCodes,
    voucherIds,
  });
  
  
  // create combined object
  const result: SanityOrderProductsVariantsVouchersShippings = {
    products: data.products,
    variants: data.variants,
    vouchers: data.vouchers,
    userOrderCount: data.userOrderCount,
    shippingCountries: data.shippingCountries,
    user: data.user,
  };

  return result
}

export const getOrder = async (paymentIntentId: string) => {
  return sanity.fetch(
    '*[_type == "order" && paymentIntentId == $paymentIntentId][0]', { paymentIntentId }
  );
}

const orderMetaPayload = `
  _createdAt,
  _updatedAt,
  items[]{
    _key,
    type,
    price,
    productId,
    title,
    options,
    quantity,
    type == ${ProductTypes.SANITY_PRODUCT_BUNDLE} => {
      items[]{
        _key,
        type,
        productId,
        parentId,
        title,
        count
      }
    },
    "image": coalesce(
      *[_type == "productVariant" && _id == ^.productId][0].images[0]{${imagePayload}},
      *[_type == "product" && _id == ^.parentId][0].images[0]{${imagePayload}},
      *[_type == "product" && _id == ^.productId][0].images[0]{${imagePayload}}
    )
  },
  totals,
  shipping,
  freeProducts[]{
    title,
    "image": coalesce(
      *[_type == "productVariant" && _id == ^.productId][0].images[0]{${imagePayload}},
      *[_type == "product" && _id == ^.productId][0].images[0]{${imagePayload}}
    ),
    quantity
  }
`
const orderPayload = `
  ${orderMetaPayload},
  orderNumber,
  status
`;

export const getUserOrders = async ({userId, email}: {userId: string, email?: string}): Promise<SanityOrderForClient[]> => {
  // TODO: think about this
  const allConditions = `(supabaseUserId == $userId || contactEmail == $email)`;
  // const allConditions = `(contactEmail == "${email}")`;
  const query = `
  *[_type == "order" && ${allConditions}] {${orderPayload}}
  `
  return await sanity.fetch(query, {
    userId,
    email
  });
}

export const getOrderMetaWithPaymentIntentId = async ({paymentIntentId}: {paymentIntentId: string}): Promise<SanityOrderForClient | null> => {
  const query = `*[_type == "orderMeta" && paymentIntentId == $paymentIntentId] {${orderMetaPayload}}`
  const sanityOrders: SanityOrderForClient[] = await sanity.fetch(query, {
    paymentIntentId
  });

  if (sanityOrders.length > 0) {
    return sanityOrders[0];  
  } else {
    return null;
  }  
}

const orderGetPayload = `
  ...,
  "customerNumber": *[_type == "user" && externalUserId == ^.supabaseUserId][0].customerNumber,
  shipping,
  "trackingUrl": shipping.shippingCountry->rates[_key == ^.shipping.rateId][0].trackingUrl
`

const orderByIdQuery = `
  *[_type == "order" && _id == $orderId][0] {${orderGetPayload}}
`

export const getSettingsAndOrderById = async ({orderId}: {orderId: string}): Promise<SanitySettingsAndOrderByIdResult> => {
  const query = `{
    "settings": ${settingsQuery},
    "order": ${orderByIdQuery}
  }
  `
  return sanity.fetch(query, { orderId });
}
export const getOrderByPaymentIntentId = async ({paymentIntentId}: {paymentIntentId: string}): Promise<SanityOrderCreateResult> => {
  const query = `
  *[_type == "order" && paymentIntentId == $paymentIntentId][0] {${orderGetPayload}}
  `
  return sanity.fetch(query, {
    paymentIntentId
  });
}

export const createOrder = async (order: SanityOrderCreate): Promise<SanityOrderCreateResult> => {
  return sanity.create(order, {
    autoGenerateArrayKeys: true
  });
}

export const updateOrderStates = async (orderId: string, data: Record<string, any>, historyStateItem: SanityOrderStatusHistoryItem) => {
  try {
    await sanity.patch(orderId).set(data).append('statusHistory', [historyStateItem]).commit({ autoGenerateArrayKeys: true, returnDocuments: false });
  } catch (error) {
    throw error;
  }
}

export const getOrderMeta = async (orderMetaId: string): Promise<SanityOrderMetaGet> => {
  return sanity.getDocument(orderMetaId) as Promise<SanityOrderMetaGet>;
}

export const createOrderMeta = async (orderMetaId: string, data: SanityOrderMetaCreate) => {
  const orderMeta = {
    _id: orderMetaId,
    _type: 'orderMeta',
    ...data
  }
  return sanity.create(orderMeta, {
    autoGenerateArrayKeys: true
  });
}

export const updateOrderMeta = async (orderMetaId: string, data: SanityOrderMetaUpdate): Promise<string> => {
  const patch = sanity
    .patch(orderMetaId)
    .set(data)

  //   const patch = sanity
  //   .patch(orderMetaId)
  //   .set({ items: items.map(item => ({
  //     ...item,
  //     price: item.price/100
  //   })) })
  //   .set({ locale })
  //   .set({ contactEmail: addressData.email })
  //   .set({ shippingAddress: addressData.shipping })
  // addressData.billing != undefined &&
  //   patch.set({ billingAddress: addressData.billing })
  // userId != undefined &&
  //   patch.set({ supabaseUserId: userId })

  const result = await patch.commit();
  return result.paymentIntentId;
}


export const getUser = async ({externalUserId}: {externalUserId: string}): Promise<SanityUser> => {
  const query = `
    *[_type == "user" && externalUserId == $externalUserId][0] {
      _id,
      _createdAt,
      _updatedAt,
      email,
      externalUserId,
      status,
      locale
    }
  `
  return sanity.fetch(query, {
    externalUserId
  });
}
// export const getUser = async (params) => {
//   const conditions = Object.keys(params).map(key => `${key} == $${key}`).join(' && ');
//   const query = `
//     *[_type == "user" && ${conditions}][0]
//   `
//   return sanity.fetch(query, params);
// }

export const createUser = async ({
  email,
  externalUserId,
  customerNumber,
  registerForNewsletter,
  status,
  locale,
}: {
  email: string,
  externalUserId: string,
  customerNumber: string,
  registerForNewsletter: boolean
  status: string
  locale: string
}) => {
  const user = {
    _type: 'user',
    email,
    externalUserId,
    customerNumber,
    receiveNewsletter: registerForNewsletter,
    status,
    locale
  }
  return sanity.create(user, {
    // autoGenerateArrayKeys: true
  });
}

export const getLatestCustomerNumber = async (): Promise<string> => {
  const query = `*[_type == "user"] | order(customerNumber desc)[0]{customerNumber}`;
  const latest = await sanity.fetch(query);
  
  const lastNumber = latest?.customerNumber || '10000';
  const nextNumber = parseInt(lastNumber, 10) + 1;
  const customerNumber = `${nextNumber}`;
  return customerNumber
}

const settingsQuery = `
  *[_type == "generalSettings"][0] {
    companyName,
    companyOwner,
    companyPhone,
    companyStreet,
    companyZip,
    companyCity,
    companyCountry,
    companyState,
    companyEmail,
    companyUID,
    bankName,
    bankIBAN,
    bankBIC,
    orderNumberPrefix,
    invoiceNumberPrefix,
    lastInvoiceNumber,
  }
`

export const getSettings = async (): Promise<SanitySettings> => {
    return sanity.fetch(settingsQuery);
}

export const updateLastInvoiceNumber = async (lastInvoiceNumber: number) => {
  return sanity
    .patch("generalSettings")
    .set({ lastInvoiceNumber })
    .commit();
}

export const getPages = async (): Promise<PageMinimal[]> => {
  const query = `*[_type == "page"]{_id,title}`
  return await sanity.fetch(query);
}

type SanityStockLevelProduct = {
  id: string,
  quantity: number
}
export const updateStockLevels = async (productStockLevels: SanityStockLevelProduct[]) => {
  const tx = sanity.transaction();
  productStockLevels.forEach(({ id, quantity }) => {
    tx.patch(id, p => p.dec({ stock: quantity })); // decrement stock
  });
  return await tx.commit();
}

type SanityBaseStockInfo = {
  _id: string,
  title: LocalizedString,
  stock: number
}
type SanityProductStockInfo = SanityBaseStockInfo
type SanityProductVariantStockInfo = SanityBaseStockInfo & {
  parentId: string
}
type SanityStockInfoResult = {
  threshold?: number;
  shopName?: string;
  products: SanityProductStockInfo[];
  variants: SanityProductVariantStockInfo[];
}
export const getLowStockProducts = async (): Promise<SanityStockInfoResult> => {
  const query = `
  {
    "threshold": *[_type == "generalSettings"][0].stockThreshold,
    "shopName": *[_type == "generalSettings"][0].companyName,
    "products": *[_type == "product" 
      && (!defined(variants) || count(variants) == 0) 
      && stock < coalesce(stockThreshold, *[_type=="generalSettings"][0].stockThreshold)]{
      _id,
      title,
      stock
    },
    "variants": *[_type == "productVariant" 
      && active == true
      && stock < coalesce(stockThreshold, *[_type=="generalSettings"][0].stockThreshold)]{
      _id,
      title,
      stock,
      "parentId": *[_type == "product" && references(^._id)][0]._id
    }
  }
  `;
  return await sanity.fetch(query);
}

export const getInventoryProducts = async (): Promise<SanityInventoryResult> => {
  const sharedProps = [
    "_id",
    "_type",
    "title",
    "price",
    "compareAtPrice",
    "productNumber",
    "stock",
  ]
  const variantProps = [
    "active",
    ...sharedProps,
  ]
  const productProps = [
    ...sharedProps,
  ]
  const query = `{
    "shopName": *[_type == "generalSettings"][0].companyName,
    "products": *[_type == "product"] {
      ${productProps.join(',')},"variants": variants[]->{${variantProps.join(',')}}
    }
  }`
  return await sanity.fetch(query);
}