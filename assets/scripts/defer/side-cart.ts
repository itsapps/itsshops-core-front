import * as localStorageCart from 'cart-localstorage' ;
import {localizeCurrencyNumber, toggleElement, replacePicture} from '../lib/utils';
import {LocalStorageCartItem, LocalStorageCartBundleItemParsed, LocalCartProps, CartItem} from '../lib/client_types';
import { pictureSizes } from '../../../_config/image-settings.mjs';
import {isBundleProduct} from '../../../../shared/enums.mjs';

const localCart = (props: LocalCartProps) => {
  const {
    empty,
    subtotal,
    itemList,
    itemCount,
    itemTemplate,
    footer,
  } = props;

  const clear = () => {
    (localStorageCart.list() as LocalStorageCartItem[]).forEach(item => {
      localStorageCart.remove(item.id);
    })
  }

  const removeItem = (id: string) => {
    localStorageCart.remove(id);
    render();

    const event = new CustomEvent("cart:update", {});
    window.dispatchEvent(event);
  }

  const getItems = (): LocalStorageCartItem[] => {
    return localStorageCart.list();
  }

  const updatePriceElement = (priceElement: HTMLElement | null, price: number, quantity: number) => {
    if (priceElement) {
      priceElement.textContent = localizeCurrencyNumber(price*quantity/100, document.documentElement.lang);
    }
  }
  const updateLineQuantity = (productId: string, counter: HTMLInputElement | null, priceElement: HTMLElement | null, price: number, increment: number) => {
    const counterValue = counter?.value || "1";
    const lineQuantity = parseInt(counterValue, 10);
    const newQuantity = Math.max(1, lineQuantity + increment) 
    if (counter) {
      counter.value = `${newQuantity}`;
    }
    localStorageCart.update(productId, 'quantity', newQuantity);
    updatePriceElement(priceElement, price, newQuantity);
  };
  const updateInputLineQuantity = (productId: string, counter: HTMLInputElement, priceElement: HTMLElement | null, price: number) => {
    const counterValue = counter.value;
    const lineQuantity = parseInt(counterValue, 10);
    const newQuantity = Math.max(1, lineQuantity) 
    localStorageCart.update(productId, 'quantity', newQuantity);
    updatePriceElement(priceElement, price, newQuantity);
  };

  const updateSubtotal = () => {
    subtotal.textContent = localizeCurrencyNumber(localStorageCart.total()/100, document.documentElement.lang);

    if (itemCount) {
      const items = localStorageCart.list() as LocalStorageCartItem[];
      const count = items.map(item => item.quantity).reduce((a, b) => a + b, 0)
      itemCount.textContent = `${count} Artikel`;
    }
  }
  
  const render = () => {
    if (itemList == null) {
      return;
    }

    // Clear the product list
    itemList.innerHTML = '';

    const items = localStorageCart.list() as LocalStorageCartItem[];
    const isEmpty = items.length === 0;
    toggleElement(empty, isEmpty);
    toggleElement(footer, !isEmpty);
    toggleElement(itemList, !isEmpty);
    toggleElement(itemCount, !isEmpty);

    if (isEmpty) {
      subtotal.textContent = "";
      return;
    }

    // Loop through stored cart and render each product
    let itemCountValue = 0;
    items.forEach(product => {
      itemCountValue += product.quantity;
      const clone = itemTemplate.content.cloneNode(true) as DocumentFragment;
      
      clone.querySelector('[data-name="name"]')!.textContent = product.title;
      if (isBundleProduct(product.type)) {
        const bundleItems: LocalStorageCartBundleItemParsed[] = product.bundleItems ? JSON.parse(product.bundleItems) : [];
        clone.querySelector('[data-name="variant"]')!.textContent = bundleItems.map(item => `${item.count} x ${item.title}`).join(', ');
      } else {
        clone.querySelector('[data-name="variant"]')!.textContent = product.variant;
      }
      (clone.querySelector('[data-name="link"]')! as HTMLAnchorElement).href = product.path;
      
      // clone.querySelector('[data-name="quantity-current"]')!.textContent = `${product.quantity}`;
      const priceElement = clone.querySelector('[data-name="price-current"]')! as HTMLElement;
      updatePriceElement(priceElement, product.price, product.quantity);
      
      // clone.querySelector('.cart-item--quantity').textContent = product.quantity;
      if (product.image) {
        const picture = clone.querySelector('[data-name="photo"] picture') as HTMLPictureElement;
        if (picture) {
          replacePicture(picture, product.image, pictureSizes.productSmall, product.title);
        }
      }
      // Handle remove button
      const removeButton = clone.querySelector('[data-name="remove-item"]');
      if (removeButton) {
        removeButton.addEventListener('click', (e: Event) => {
          e.preventDefault();
          removeItem(product.id);
        });
      }

      // counters
      const counterDown = clone.querySelector('[data-name="product-counter-down"]');
      const counterUp = clone.querySelector('[data-name="product-counter-up"]');
      const counterInput = clone.querySelector('[data-name="product-counter-input"]') as HTMLInputElement | null;
      if (counterDown) {
        counterDown.addEventListener('click', () => {
          updateLineQuantity(product.id, counterInput, priceElement, product.price, -1);
          updateSubtotal();
        });
      }
      if (counterUp) {
        counterUp.addEventListener('click', () => {
          updateLineQuantity(product.id, counterInput, priceElement, product.price, 1);
          updateSubtotal();
        });
      }
      if (counterInput) {
        counterInput.value = `${product.quantity}`;
        counterInput.addEventListener('change', () => {
          updateInputLineQuantity(product.id, counterInput, priceElement, product.price);
          updateSubtotal();
        });
      }
      
      itemList.appendChild(clone);
    });

    updateSubtotal();
  }

  const addItem = (product: CartItem, quantity: number) => {
    localStorageCart.add(product, quantity);
  }

  const isValid = () => {
    return localStorageCart.list().length > 0;
  }

  return {
    render,
    getItems,
    addItem,
    clear,
    isValid,
  }
}

const sidebar = document.getElementById('sidecart')! as HTMLElement;
const emptyCart = document.getElementById('side-cart-empty')! as HTMLElement;
const cartFooter = sidebar.querySelector('.cart--footer')! as HTMLElement;
const subtotalPrice = sidebar.querySelector('.cart--subtotal-price')! as HTMLElement;
const cartProductCount = document.getElementById('cart-product-count') as HTMLElement;
const cartProductList = document.getElementById('cart-product-list')! as HTMLUListElement;
const template = document.getElementById('cart-item-template')! as HTMLTemplateElement;

const cart = localCart({
  empty: emptyCart,
  subtotal: subtotalPrice,
  itemList: cartProductList,
  itemCount: cartProductCount,
  itemTemplate: template,
  footer: cartFooter,
})

const sideCartButton = document.querySelector('[data-toggle-sidebar="sidecart"]') as HTMLButtonElement;
if (sideCartButton) {
  sideCartButton.addEventListener('sidebar_toggle', (e: Event) => {
    const event = e as CustomEvent;
    if (event.detail.shouldExpand) {
      cart.render();
    }
  });
}