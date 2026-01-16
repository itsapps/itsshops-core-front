import * as localStorageCart from 'cart-localstorage' ;
import { debounce } from './debounce.ts';
import {localizeCurrencyNumber, toggleElement, replacePicture} from './utils';
import { pictureSizes } from '../../../_config/image-settings.mjs';
import {
  CheckoutCalculatePayment,
  CheckoutCreatePayment,
  Voucher,
} from '../../../../shared/shared_types.mjs';
import {
  LocalStorageCartItem,
  LocalStorageCartBundleItemParsed,
  CartItem,
} from './client_types';
import {isBundleProduct} from '../../../../shared/enums.mjs';

interface CartOptions {
  onUpdate: (id: string) => void;
  onVoucherRemove: (voucher: Voucher) => void;
  locale?: string;
}

type ChangeRecord = {
  from: number;
  to: number;
};

type ChangedItems = {
  quantity: Record<string, ChangeRecord>;
  price: Record<string, ChangeRecord>;
};

export class LocalCart {
  private options: CartOptions;
  private locale: string;

  private emptyElement: HTMLElement;
  private itemListElement: HTMLUListElement;
  private listItemTemplate: HTMLTemplateElement;
  private voucherListElement: HTMLUListElement;
  private listVoucherTemplate: HTMLTemplateElement;
  private footerElement: HTMLElement;
  
  private subtotalContainerElement: HTMLElement;
  private subtotalElement: HTMLElement;
  private shippingContainerElement: HTMLElement;
  private shippingElement: HTMLElement;
  private discountContainerElement: HTMLElement;
  private discountElement: HTMLElement;
  private taxContainerElement: HTMLElement;
  private taxElement: HTMLElement;
  private totalContainerElement: HTMLElement;
  private totalElement: HTMLElement;
  private changedItems: ChangedItems = {
    quantity: {},
    price: {},
  };
  private debouncedUpdateMap: Map<string, (productId: string) => void> = new Map();

  constructor(cartId: string, options: CartOptions) {
    this.options = options;
    this.locale = options.locale || document.documentElement.lang;

    const containerId = cartId;
    this.emptyElement = document.getElementById(`${containerId}-empty`)!;
    this.itemListElement = document.getElementById(`${containerId}-product-list`)! as HTMLUListElement;
    this.listItemTemplate = document.getElementById(`${containerId}-item-template`)! as HTMLTemplateElement;
    this.voucherListElement = document.getElementById(`${containerId}-voucher-list`)! as HTMLUListElement;
    this.listVoucherTemplate = document.getElementById(`${containerId}-voucher-template`)! as HTMLTemplateElement;
    this.footerElement = document.getElementById(`${containerId}-footer`)!;

    this.subtotalContainerElement = document.getElementById(`${containerId}-footer-subtotal`)!;
    this.subtotalElement = document.getElementById(`${containerId}-subtotal`)!;
    this.shippingContainerElement = document.getElementById(`${containerId}-footer-shipping`)!;
    this.shippingElement = document.getElementById(`${containerId}-shipping`)!;
    this.discountContainerElement = document.getElementById(`${containerId}-footer-discount`)!;
    this.discountElement = document.getElementById(`${containerId}-discount`)!;
    this.taxContainerElement = document.getElementById(`${containerId}-footer-tax`)!;
    this.taxElement = document.getElementById(`${containerId}-tax`)!;
    this.totalContainerElement = document.getElementById(`${containerId}-footer-total`)!;
    this.totalElement = document.getElementById(`${containerId}-total`)!;
  }

  public clear() {
    localStorageCart.destroy();
  }

  public getItems(): LocalStorageCartItem[] {
    return localStorageCart.list() as LocalStorageCartItem[];
  }

  public addItem(product: CartItem, quantity: number) {
    localStorageCart.add(product, quantity);
  }

  public isValid() {
    return localStorageCart.list().length > 0;
  }

  public updateItems({items, missingProducts}: CheckoutCalculatePayment | CheckoutCreatePayment) {
    this.changedItems.quantity = {};
    this.changedItems.price = {};

    let didChange = false;
    items.forEach(item => {
      const cartItem: LocalStorageCartItem = localStorageCart.get(item.id);
      if (!cartItem) {
        console.error('cart item not found')
      } else {
        if (cartItem.quantity !== item.quantity) {
          this.changedItems.quantity[item.id] = {from: cartItem.quantity, to: item.quantity}
          didChange = true;
          localStorageCart.update(item.id, 'quantity', item.quantity);
        }
        if (cartItem.price !== item.price) {
          this.changedItems.price[item.id] = {from: cartItem.price, to: item.price}
          didChange = true;
          localStorageCart.update(item.id, 'price', item.price);
        }
      }
    });
    missingProducts.forEach(item => {
      localStorageCart.remove(item);
      didChange = true;
    });

    return didChange;
  }

  private removeItem(id: string) {
    localStorageCart.remove(id);
    this.options.onUpdate(id);
  }
  private removeVoucher(e: Event, voucher: Voucher) {
    if (e.currentTarget instanceof HTMLButtonElement) {
      e.currentTarget.disabled = true;
    }
    this.options.onVoucherRemove(voucher);
  }

  private updatePriceElement(priceElement: HTMLElement | null, price: number, quantity: number) {
    if (priceElement) {
      priceElement.textContent = localizeCurrencyNumber(price*quantity/100, this.locale);
    }
  }
  private updateLineQuantity(productId: string, counter: HTMLInputElement | null, priceElement: HTMLElement | null, price: number, increment: number) {
    console.log("update line quantity")
    const counterValue = counter?.value || "1";
    const lineQuantity = parseInt(counterValue, 10);
    const newQuantity = Math.max(1, lineQuantity + increment) 
    if (counter) {
      counter.value = `${newQuantity}`;
    }
    localStorageCart.update(productId, 'quantity', newQuantity);
    this.updatePriceElement(priceElement, price, newQuantity);
    this.debouncedOnUpdate(productId);
  };
  private updateInputLineQuantity(productId: string, counter: HTMLInputElement, priceElement: HTMLElement | null, price: number) {
    const counterValue = counter.value;
    const lineQuantity = parseInt(counterValue, 10);
    const newQuantity = Math.max(1, lineQuantity) 
    localStorageCart.update(productId, 'quantity', newQuantity);
    this.updatePriceElement(priceElement, price, newQuantity);
    this.debouncedOnUpdate(productId);
  };

  private debouncedOnUpdate(productId: string) {
    // If we don't have a debounced function for this productId yet, create it
    if (!this.debouncedUpdateMap.has(productId)) {
      const debouncedFn = debounce((id: string) => {
        this.options.onUpdate(id);
      }, 500);
      this.debouncedUpdateMap.set(productId, debouncedFn);
    }

    // Call the stored debounced function
    const fn = this.debouncedUpdateMap.get(productId);
    fn?.(productId);
  }

  public setLoading(loading: boolean) {
    this.voucherListElement.querySelectorAll('button').forEach(button => {
      button.disabled = loading
    })
    const buttonAndInputs = this.itemListElement.querySelectorAll('button, input') as NodeListOf<HTMLButtonElement | HTMLInputElement>
    buttonAndInputs.forEach(disableable => {
      disableable.disabled = loading
    })
  }

  public render({
    shipping,
    tax,
    taxRate,
    subtotal,
    total,
    discount,
    vouchers,
  }: {
    shipping?: number,
    tax?: number,
    taxRate?: number,
    subtotal?: number,
    discount?: number,
    total?: number,
    vouchers?: Voucher[],
  } = {}) {
    if (this.itemListElement == null) {
      return;
    }

    // Clear the product list
    this.itemListElement.innerHTML = '';
    // Clear the voucher list
    this.voucherListElement.innerHTML = '';

    const items = localStorageCart.list() as LocalStorageCartItem[];
    const isEmpty = items.length === 0;
    const isVouchersEmpty = (vouchers || []).length === 0;
    toggleElement(this.emptyElement, isEmpty);
    toggleElement(this.footerElement, !isEmpty);
    toggleElement(this.itemListElement, !isEmpty);
    toggleElement(this.voucherListElement, (!isEmpty && !isVouchersEmpty));

    if (isEmpty) {
      return;
    }

    // Loop through stored cart and render each product
    items.forEach(product => {
      const clone = this.listItemTemplate.content.cloneNode(true) as DocumentFragment;
      
      // const changedQuantity = this.changedItems["quantity"][product.id];
      const changedPrice = this.changedItems["price"][product.id];

      clone.querySelector('[data-name="name"]')!.textContent = product.title;

      if (isBundleProduct(product.type)) {
        const bundleItems: LocalStorageCartBundleItemParsed[] = product.bundleItems ? JSON.parse(product.bundleItems) : [];
        clone.querySelector('[data-name="variant"]')!.textContent = bundleItems.map(item => `${item.count} x ${item.title}`).join(', ');
      } else {
        clone.querySelector('[data-name="variant"]')!.textContent = product.variant;
      }
      (clone.querySelector('[data-name="link"]')! as HTMLAnchorElement).href = product.path;
      
      // const previousQuantity = changedQuantity ? changedQuantity.from : undefined;
      // const currentQuantity = changedQuantity ? changedQuantity.to : product.quantity;
      // clone.querySelector('[data-name="quantity-previous"]')!.textContent = previousQuantity !== undefined ? `${previousQuantity}` : "";
      // clone.querySelector('[data-name="quantity-current"]')!.textContent = `${currentQuantity}`;

      const previousPrice = changedPrice ? changedPrice.from : undefined;
      const currentPrice = changedPrice ? changedPrice.to : product.price;
      clone.querySelector('[data-name="price-previous"]')!.textContent = previousPrice !== undefined ? localizeCurrencyNumber(previousPrice*product.quantity/100, this.locale) : "";
      const priceElement = clone.querySelector('[data-name="price-current"]')! as HTMLElement;
      this.updatePriceElement(priceElement, currentPrice, product.quantity);

      if (product.image) {
        const picture = clone.querySelector('[data-name="photo"] > picture') as HTMLPictureElement;
        if (picture) {
          replacePicture(picture, product.image, pictureSizes.productSmall, product.title);
        }
        
      }

      // Handle remove button
      const removeButton = clone.querySelector('[data-name="remove-item"]');
      if (removeButton) {
        removeButton.addEventListener('click', (e: Event) => {
          if (e.currentTarget instanceof HTMLButtonElement) {
            e.currentTarget.disabled = true;
          }
          this.removeItem(product.id);
        });
      }

      // counters
      const counterDown = clone.querySelector('[data-name="product-counter-down"]');
      const counterUp = clone.querySelector('[data-name="product-counter-up"]');
      const counterInput = clone.querySelector('[data-name="product-counter-input"]') as HTMLInputElement | null;
      if (counterDown) {
        counterDown.addEventListener('click', () => {
          this.updateLineQuantity(product.id, counterInput, priceElement, product.price, -1);
        });
      }
      if (counterUp) {
        counterUp.addEventListener('click', () => {
          this.updateLineQuantity(product.id, counterInput, priceElement, product.price, 1);
        });
      }
      if (counterInput) {
        counterInput.value = `${product.quantity}`;
        counterInput.addEventListener('change', () => {
          this.updateInputLineQuantity(product.id, counterInput, priceElement, product.price);
        });
      }

      this.itemListElement.appendChild(clone);
    });

    // render vouchers
    (vouchers || []).forEach(voucher => {
      const clone = this.listVoucherTemplate.content.cloneNode(true) as DocumentFragment;
      if (voucher.disabled) {
        const li = clone.querySelector('li');
        li?.classList.add('disabled');
      }
      
      clone.querySelector('[data-name="name"]')!.textContent = voucher.title;
      const codeElement = clone.querySelector('[data-name="code"]')!
      if (voucher.code) codeElement.textContent = voucher.code;
      else codeElement.remove();
      clone.querySelector('[data-name="description"]')!.textContent = voucher.description;

      const messagesElement = clone.querySelector('[data-name="messages"]')!
      const freeProductsElement = clone.querySelector('[data-name="free-products"]')!
      if (voucher.disabled) {
        if (voucher.messages.length > 0) {
          voucher.messages.forEach(message => {
            const liElement = document.createElement('li');
            liElement.setAttribute('role', 'listitem');
            liElement.textContent = message;
            messagesElement.appendChild(liElement);
          })
        } else {
          messagesElement.remove();
        }
        freeProductsElement.remove();
      } else {
         if (voucher.freeProducts.length > 0) {
          voucher.freeProducts.forEach(p => {
            const liElement = document.createElement('li');
            liElement.setAttribute('role', 'listitem');
            liElement.textContent = `${p.quantity} × ${p.title}`;
            freeProductsElement.appendChild(liElement);
          })
        } else {
          freeProductsElement.remove();
        }
        messagesElement.remove();
      }

      // Handle remove button
      const removeButton = clone.querySelector('[data-name="remove-item"]')!;
      const enableButton = clone.querySelector('[data-name="enable-item"]')!;
      const disableButton = clone.querySelector('[data-name="disable-item"]')!;
      if (voucher.code) {
        removeButton.addEventListener('click', (e: Event) => this.removeVoucher(e, voucher));
        enableButton.remove();
        disableButton.remove();
      } else {
        removeButton.remove();
        if (voucher.disabled) {
          enableButton.addEventListener('click', (e: Event) => this.removeVoucher(e, voucher));
          disableButton.remove();
        } else {
          disableButton.addEventListener('click', (e: Event) => this.removeVoucher(e, voucher));
          enableButton.remove();
        }
      }


      this.voucherListElement.appendChild(clone);
    });


    // summaries
    if (shipping !== undefined) {
      this.shippingElement.textContent = localizeCurrencyNumber(shipping, this.locale);
    }
    toggleElement(this.shippingContainerElement, shipping !== undefined);

    // if (tax !== undefined && taxRate !== undefined) {
    //   this.taxElement.textContent = `${localizeCurrencyNumber(tax, this.locale)} (${taxRate*100}%)`;
    // }
    // toggleElement(this.taxContainerElement, tax !== undefined);

    if (subtotal !== undefined) {
      this.subtotalElement.textContent = localizeCurrencyNumber(subtotal, this.locale);
    }
    toggleElement(this.subtotalContainerElement, subtotal !== undefined);
    
    if (discount !== undefined) {
      this.discountElement.textContent = localizeCurrencyNumber(-discount, this.locale);
    }
    toggleElement(this.discountContainerElement, discount !== undefined);

    if (total !== undefined) {
      this.totalElement.textContent = localizeCurrencyNumber(total, this.locale);
    }
    toggleElement(this.totalContainerElement, total !== undefined);
  }
}
