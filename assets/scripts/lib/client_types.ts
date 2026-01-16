export type LocalStorageCartItem = {
  type: number,
  id: string,
  price: number,
  title: string,
  image: string,
  variant: string,
  parent: string,
  path: string,
  quantity: number,
  bundleItems: string
}
export type LocalStorageCartBundleItemParsed = {
  type: number,
  productId: string,
  parentId: string,
  count: number,
  title: string,
}
export type CartItem = Omit<LocalStorageCartItem, 'quantity'>

export type LocalCartProps = {
  empty: HTMLElement,
  subtotal: HTMLElement,
  itemList: HTMLUListElement,
  itemCount?: HTMLElement,
  itemTemplate: HTMLTemplateElement,
  footer: HTMLElement,
}
export type LocalVoucher = {
  id: string;
  code: string | null;
  disabled: boolean;
}

export type PictureDefinition = {
  sizes: number[][],
  widths: string
}