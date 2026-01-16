import { getOrders } from '../lib/api';
import { getLocalUser, deleteLocalUser} from '../lib/local-storage';
import { AuthError } from '../lib/browser-errors';
import { retryHandler } from '../lib/error-handler';
import { createOrderHTML, replacePicture, formatDate } from '../lib/utils';
import { createTranslator, BrowserTranslations } from '../lib/translation.ts';
import { pictureSizes } from '../../../_config/image-settings.mjs';
import { ClientOrder } from '../../../../shared/shared_types.mjs';

const translations: BrowserTranslations = {
  en: {
    header: "Order from {{title}}",
  },
  de: {
    header: "Bestellung vom {{title}}",
  }
}
const t = createTranslator(translations);

const locale = document.documentElement.lang;
const itemList = document.getElementById('order-list') as HTMLOListElement;
const noOrders = document.getElementById('order-list-no-orders') as HTMLElement;
const template = document.getElementById('order-item-template') as HTMLTemplateElement;
const productItemTemplate = document.getElementById('order-item-product-template') as HTMLTemplateElement;
const previewTemplate = document.getElementById('order-item-preview-template') as HTMLTemplateElement;
const previewPhotoTemplate = document.getElementById('order-item-preview-photo-template') as HTMLTemplateElement;

const updateOrderList = (orders: ClientOrder[]) => {
  itemList.innerHTML = '';

  if (orders.length === 0) {
    noOrders.classList.remove('hidden');
    itemList.classList.add('hidden');
    return;
  } else {
    noOrders.classList.add('hidden');
    itemList.classList.remove('hidden');
  }

  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  orders.forEach(order => {
    const li = previewTemplate.content.cloneNode(true) as DocumentFragment;
    
    li.querySelector('[data-name="header"]')!.textContent = t('header', {title: formatDate(order.createdAt, locale, 'short')});
    const photoContainer = li.querySelector('[data-name="photo-container"]') as HTMLDivElement;
    order.items.forEach(item => {
      if (item.image) {
        const photoClone = previewPhotoTemplate.content.cloneNode(true) as DocumentFragment;
        const picture = photoClone.querySelector('[data-name="photo"] picture') as HTMLPictureElement;
        if (picture) {
          replacePicture(picture, item.image, pictureSizes.productSmall, item.title);
        }
        photoContainer.appendChild(photoClone);
      }  
    })

    const orderContainer = li.querySelector('[data-name="order"]') as HTMLDivElement;
    const clone = createOrderHTML(order, locale, pictureSizes.productXS, template, productItemTemplate);
    orderContainer.appendChild(clone);

    // details button toggling
    const detailsButton = li.querySelector('[data-name="details-button"]') as HTMLButtonElement;
    detailsButton.addEventListener('click', () => {
      const expanded = detailsButton.getAttribute("aria-expanded") === "true" || false;
      detailsButton.setAttribute("aria-expanded", !expanded ? "true" : "false");
      if (expanded) {
        orderContainer.classList.add('hidden');
      } else {
        orderContainer.classList.remove('hidden');
      }
    });
    
    itemList.appendChild(li);
  })
}

if (getLocalUser()) {
  const orderRetryHandler = retryHandler(
    () => getOrders(), {
      successHandler: (data) => {
        updateOrderList(data.orders)
      },
      errorHandler: (error) => {
        if (error instanceof AuthError) {
          deleteLocalUser();
        }
      },
      removeRetryButtonOnSuccess: true
    }
  );
  orderRetryHandler.doAction();
} else {
  const loginLink = itemList.dataset.loginPermalink;
  const loginUrl = `${loginLink}?next=${encodeURIComponent(window.location.href)}`
  window.location.href = loginUrl
}