export type ExposedUser = {
  email?: string,
  lastSignIn?: string,
  id: string
}

export type FieldError = {
  [field: string]: string;
};

export type LocalizedString = {
  [locale: string]: string;
};

export type PartialAddress = {
  city?: string;
  country: string;
  zip?: string;
  state?: string;
};

export type Address = {
  city: string;
  country: string;
  zip: string;
  state?: string;
  name: string;
  prename: string;
  lastname: string;
  phone?: string;
  line1: string;
  line2?: string;
};

export type AddressData = {
  email: string;
  shipping: Address;
  billing?: Address;
}

export type BaseCartItem = {
  type: number;
  id: string;
  quantity: number;
  parent?: string;
}
export type CartItem = BaseCartItem
export type BundleItem = {
  type: number;
  productId: string;
  parentId: string;
  count: number;
}
export type CartBundleItem = BaseCartItem & {
  items: BundleItem[]
}

export type Cart = {
  items: (CartItem | CartBundleItem)[];
}
export type VoucherSelection = {
  selectedIds: string[];
  disabledIds: string[];
  codes: string[];
}

export type CheckoutServerInputPayload = {
  cart: Cart;
  createPayment: boolean;
  addressData?: AddressData;
  partialAddress?: PartialAddress;
  userId?: string;
  orderMetaId?: string;
  shippingRateId?: string;
  vouchers: VoucherSelection;
}
export type CheckoutInputPayload = Omit<CheckoutServerInputPayload, 'createPayment'>

export type RegisterUserInputPayload = {
  email: string;
  password: string;
  registerForNewsletter: boolean;
  captchaToken?: string;
}

export type DeliveryUnit = 'hour' | 'day' | 'business_day' | 'week' | 'month';
export type DeliveryEstimate = {
  unit: DeliveryUnit;
  value: number;
};
export type ShippingRate = {
  id: string;
  amount: number;
  displayName: string;
  deliveryEstimate?:
    | string
    | {
        maximum?: DeliveryEstimate;
        minimum?: DeliveryEstimate;
      };
};
export type RewardProduct = {
  id: string;
  title: string;
  quantity: number;
  image: string;
}
export type Voucher = {
  id: string;
  title: string;
  code: string | null;
  messages: string[];
  description: string;
  freeProducts: RewardProduct[];
  disabled: boolean;
}
export type ShippingCountry = {
  code: string;
  title: string;
}
export type CartItemWithPrice = CartItem & { price: number; }
export type CartBundleItemWithPrice = CartBundleItem & { price: number; }
export type CheckoutCalculatePayment = {
  items: (CartItemWithPrice | CartBundleItemWithPrice)[];
  missingProducts: string[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  discount: number | null;
  shippingRates: ShippingRate[];
  selectedShippingRateId: string;
  selectedShippingCountry: string;
  supportedShippingCountries: ShippingCountry[];
  vouchers: Voucher[]
}
export type CheckoutCreatePayment = CheckoutCalculatePayment & {
  clientSecret: string;
  orderMetaId: string;
}

export enum ApiErrorType {
  VALIDATION = 1,
  IO = 2,
  AUTH = 3,
  GENERAL = 4,
  // SERVER = 'SERVER', // cannot mix string and number in same enum
}

export enum PaymentValidationErrorReason {
  productZeroAmount = 1,
  noValidProducts = 2,
  general = 3,
}

export interface ApiErrorResponse {
  type: ApiErrorType;
  message: string;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export type ClientOrderProductItemOption = {
  title: string;
  group: string;
}
export type ClientOrderProductBundleItem = {
  title: string;
  count: number;
}

export type BaseClientOrderProductItem = {
  type: number;
  price: number;
  title: string;
  quantity: number;
  image: string | null;
}
export type ClientOrderProductItem = BaseClientOrderProductItem & {
  options: ClientOrderProductItemOption[];
}
export type ClientOrderProductBundle = BaseClientOrderProductItem & {
  items: ClientOrderProductBundleItem[];
}
export type ClientOrderFreeProduct = {
  title: string;
  quantity: number;
  image: string;
}

export type OrderStatus = 'created' | 'processing' | 'shipped' | 'delivered' | 'returned' | 'canceled';
export type OrderPaymentStatus = 'succeeded' | 'refunded' | 'partiallyRefunded';

export type ClientOrder = {
  createdAt: string;
  updatedAt: string;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  statusText?: string;
  total: number;
  subtotal: number;
  tax: number;
  taxRate: number;
  discount: number | null;
  shippingRate: number;
  shippingTitle: string;
  orderNumber?: string;
  currency: string;
  items: (ClientOrderProductItem | ClientOrderProductBundle)[];
  freeProducts: ClientOrderFreeProduct[];
}

export type ClientOrdersResult = {
  orders: ClientOrder[];
}
export type ClientOrderResult = {
  order: ClientOrder;
}
export type LoginResult = {
  user: ExposedUser;
}
export type RedirectUrlResult = {
  redirectUrl: string;
}
export type ConfirmUserResult = RedirectUrlResult & {
  user: ExposedUser;
}
export type RecoverPasswordResult = RedirectUrlResult
export type ResetPasswordResult = RedirectUrlResult
export type RegisterUserResult = RedirectUrlResult
export type LogoutUserResult = {}

