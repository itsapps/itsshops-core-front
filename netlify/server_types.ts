import type { Context } from "@netlify/functions";
import {
  LocalizedString,
  Address,
  OrderStatus,
  OrderPaymentStatus,
} from "../shared/shared_types.mjs";
import {ProductTypes} from '../shared/enums.mjs';

export interface Logger {
  info: (message: string, data: Record<string, any>, options?: { sendMail?: boolean }) => Promise<void>;
  error: (
    message: string,
    data: Record<string, any>,
    error: Error | undefined,
    options?: { sendMail?: boolean }
  ) => Promise<void>;
}

export type OrderItemOption = {
  title: LocalizedString;
  group: LocalizedString;
}
export type OrderItemBundleItem = {
  type: number;
  parentId: string;
  productId: string;
  count: number;
  title: LocalizedString;
}
export type OrderItemBundleItemSimple = {
  count: number;
  title: LocalizedString;
}


export type RequestOptions = {
  data?: Record<string, any>,
  sendMail?: boolean,
  throwResponse?: boolean,
  retries?: number
}
export type RequestOptionsNoThrowResponse = Omit<RequestOptions, "throwResponse">

export type RequestHandlerBaseEvent = {
  request: Request,
  context: Context,
  logger: Logger,
}
export type RequestWithLog = <T extends unknown>(title: string, func: () => Promise<T>, options?: RequestOptions) => Promise<T>
export type GenericRequestWithLog = <T extends unknown>(title: string, func: () => Promise<T>, options?: RequestOptionsNoThrowResponse) => Promise<T>
export type RequestHandlerEvent = RequestHandlerBaseEvent & {
  t: any,
  locale: string,
  requestWithLog: RequestWithLog
}
export type PostRequestHandlerEvent = RequestHandlerEvent & {
  body: Record<string, any>
  requestWithLog: RequestWithLog
}
export type PostRequestGenericHandlerEvent = RequestHandlerBaseEvent & {
  requestWithLog: GenericRequestWithLog
}


export type Image = {
  _type: string;
  asset: {
    url: string;
    _id: string;
    dimensions: {
      width: number;
      height: number;
      aspectRatio: number;
    }
  },
  crop: {
    _type: string;
    bottom: number;
    left: number;
    right: number;
    top: number;
  },
  hotspot: {
    _type: string;
    height: number;
    width: number;
    x: number;
    y: number;
  }
}

export type BaseOrderItemProduct = {
  _type: string;
  type: number;
  productId: string;
  parentId?: string,
  price: number;
  vatRate: number;
  quantity: number;
  title: LocalizedString;
  categoryIds: string[];
  productNumber?: string;
}
export type OrderItemProduct = BaseOrderItemProduct & {
  options?: OrderItemOption[];
}
export type OrderItemBundleProduct = BaseOrderItemProduct & {
  items: OrderItemBundleItem[];
}

export type BaseSanityOrderItem = {
  type: number;
  productId: string;
  parentId?: string,
  price: number;
  vatRate: number;
  quantity: number;
  title: LocalizedString;
  productNumber?: string;
}
export type SanityOrderItem = BaseSanityOrderItem & {
  options?: OrderItemOption[];
}
export type SanityOrderBundleItem = BaseSanityOrderItem & {
  items: OrderItemBundleItem[];
}

export type BaseSanityOrderProduct = {
  _id: string;
  price: number;
  title: LocalizedString;
  stock: number;
  productNumber?: string;
  categoryIds: string[];
}
export type SanityOrderProduct = BaseSanityOrderProduct
export type SanityOrderBundleProduct = BaseSanityOrderProduct & {
  items: SanityOrderBundleItem[]
}
export type SanityOrderVariantOption = {
  title: LocalizedString;
  group: LocalizedString;
}
export type SanityOrderVariant = SanityOrderProduct & {
  options?: SanityOrderVariantOption[]
}

export type SanityVoucherConditionBase = {
  type: 'product' | 'category' | 'totalValue' | 'quantity' | 'userStatus';
}
export type SanityVoucherConditionProduct = SanityVoucherConditionBase & {
  productId: string;
  productTitle: string;
}
export type SanityVoucherConditionCategory = SanityVoucherConditionBase & {
  categoryId: string;
  categoryTitle: string;
  minQuantity?: number;
}
export type SanityVoucherConditionTotalValue = SanityVoucherConditionBase & {
  minValue: number;
}
export type SanityVoucherConditionQuantity = SanityVoucherConditionBase & {
  minQuantity: number;
  productId: string;
  productTitle: string;
}
export type SanityVoucherConditionUserStatus = SanityVoucherConditionBase & {
  status: 'new' | 'registered';
}
export type SanityVoucherReward = {
  productId: string;
  productTitle: LocalizedString;
  productImage: Image;
  quantity: number;
  productNumber?: string;
}
export type SanityVoucher = {
  _id: string;
  title: LocalizedString;
  description: LocalizedString;
  active: boolean;
  code: string | null;
  discountType: "fixed" | "percentage" | null;
  discountFixed: number | null;
  discountPercentage: number | null;
  stackable: boolean;
  validFrom: string | null;
  validTo: string | null;
  customerGroupIds: string[] | null;
  conditions: (
    SanityVoucherConditionProduct |
    SanityVoucherConditionCategory |
    SanityVoucherConditionTotalValue |
    SanityVoucherConditionQuantity |
    SanityVoucherConditionUserStatus
  )[] | null;
  rewards: SanityVoucherReward[] | null;
}
export type SanityShippingRate = {
  _key: string;
  title: LocalizedString;
  amount: number;
}
export type SanityShippingCountry = {
  _id: string;
  isDefault: boolean;
  title: LocalizedString;
  code: string;
  taxRate: number;
  rates: SanityShippingRate[];
}
export type SanityFreeShipping = {
  beforeDiscounts: boolean;
  threshold: number;
}
export type SanityUserStatus = 'registered' | 'invited' | 'active';
export type SanityBaseUser = {
  _id: string;
}
export type SanityUser = SanityBaseUser & {
  _createdAt: string;
  _updatedAt: string;
  externalUserId: string;
  email: string;
  status: SanityUserStatus;
  locale: string | null;
}
export type SanityOrderUser = SanityBaseUser & {
  customerGroupIds: string[] | null;
}
export type SanityOrderProductsVariantsVouchersShippings = {
  products: SanityOrderProduct[];
  variants: SanityOrderVariant[];
  vouchers: SanityVoucher[];
  userOrderCount?: number;
  shippingCountries: SanityShippingCountry[];
  user?: SanityOrderUser;
}

export type SanityShipping = {
  address: Address;
  rateId: string;
  rateTitle: string;
  rateCost: number;
  shippingCountry: {
    _type: "reference";
    _ref: string;
  };
}
export type SanityOrderTotals = {
  subtotal: number;
  total: number;
  vat: number;
  vatRate: number;
  currency: string;
  discount: number | null;
}
export type SanityOrderVoucher = {
  voucherId: string;
  title: LocalizedString;
}
export type SanityOrderFreeProduct = {
  productId: string;
  title: LocalizedString;
  quantity: number;
  productNumber?: string;
}
export type SanityOrderFreeProductWithImage = {
  title: LocalizedString;
  quantity: number;
  image: Image;
}
export type SanityOrderMetaCreate = {
  paymentIntentId: string;
  supabaseUserId?: string;
  items: (SanityOrderItem | SanityOrderBundleItem)[];
  contactEmail: string;
  shipping: SanityShipping;
  billingAddress?: Address;
  totals: SanityOrderTotals;
  vouchers?: SanityOrderVoucher[];
  freeProducts?: SanityOrderFreeProduct[];
  locale: string;
}
// export type SanityOrderMetaGet = SanityOrderMetaCreate;
export type SanityOrderMetaGet = SanityOrderMetaCreate & {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
}

export type SanityOrderMetaUpdate = Omit<SanityOrderMetaCreate, 'paymentIntentId'>

export type SanityOrderStatusHistoryItem =
  | {
      type: 'payment';
      state: OrderPaymentStatus;
      timestamp: string;
      source?: string;
      note?: string;
    }
  | {
      type: 'fulfillment';
      state: OrderStatus;
      timestamp: string;
      source?: string;
      note?: string;
    }

export type SanityOrderBase = SanityOrderMetaCreate & {
  _type: 'order';
  orderNumber: string;
  invoiceNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  statusHistory: SanityOrderStatusHistoryItem[];
}
export type SanityOrderCreate = SanityOrderBase & {
  orderMeta: {
    _type: "reference";
    _ref: string;
  };
  
}
export type SanityOrderCreateResult = SanityOrderBase & {
  _id: string;
  _createdAt: string;
  _updatedAt: string;
  customerNumber?: string;
}
export type SanityOrderGetResult = SanityOrderCreateResult & {
  trackingNumber?: string;
  trackingUrl?: string;
}

export type PaymentIntentMetadata = {
  orderMetaId: string;
  contactEmail: string;
  locale: string;
}

export type PaymentIntentCreateOrUpdatePayload = {
  amount: number;
  currency: string;
  metadata: PaymentIntentMetadata
}

export type SanityOrderBaseProductItemForClient = {
  price: number;
  title: LocalizedString;
  productId: string;
  quantity: number;
  image: Image | null;
}
export type SanityOrderProductItemForClient = SanityOrderBaseProductItemForClient & {
  type: typeof ProductTypes.SANITY_PRODUCT_VARIANT | typeof ProductTypes.SANITY_PRODUCT;
  options?: OrderItemOption[];
}
export type SanityOrderProductBundleItemForClient = SanityOrderBaseProductItemForClient & {
  type: typeof ProductTypes.SANITY_PRODUCT_BUNDLE;
  items: OrderItemBundleItemSimple[];
}
export type SanityOrderItemForClient =
  | SanityOrderProductItemForClient
  | SanityOrderProductBundleItemForClient;

export type SanityOrderForClient = {
  _createdAt: string;
  _updatedAt: string;
  items: SanityOrderItemForClient[];
  totals: SanityOrderTotals;
  orderNumber?: string;
  status?: OrderStatus;
  shipping: SanityShipping;
  freeProducts: SanityOrderFreeProductWithImage[];
}

export type SanitySettings = {
  companyName?: LocalizedString;
  companyOwner?: string;
  companyPhone?: string;
  companyStreet?: string;
  companyZip?: string;
  companyCity?: LocalizedString;
  companyCountry?: string;
  companyState?: string;
  companyEmail?: string;
  companyUID?: string;
  bankName?: string;
  bankIBAN?: string;
  bankBIC?: string;
  orderNumberPrefix?: string;
  invoiceNumberPrefix?: string;
  lastInvoiceNumber: number;
}

export type SanitySettingsAndOrderByIdResult = {
  settings: SanitySettings;
  order: SanityOrderGetResult;
}

export type Settings = {
  name: string;
  owner?: string;
  phone?: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  countryCode: string;
  state?: string;
  email: string;
  uid: string;
  bankName: string;
  bankIBAN: string;
  bankBIC: string;
  orderNumberPrefix?: string;
  invoiceNumberPrefix?: string;
}

export type RefundInputPayload = {
  paymentIntentId: string;
}

export type PageMinimal = {
  _id: string;
  title: LocalizedString;
}

export type SanityInventoryBase = {
  _id: string;
  _type: string;
  title: LocalizedString;
  price: number;
  compareAtPrice: number;
  productNumber?: string;
  stock: number;
}
export type SanityInventoryProductVariant = SanityInventoryBase & {
  active: boolean;
}
export type SanityInventoryProduct = SanityInventoryBase & {
  variants: SanityInventoryProductVariant[] | null;
}
export type SanityInventoryResult = {
  shopName?: string;
  products: SanityInventoryProduct[];
}