import { destroy } from 'cart-localstorage' ;
import { deleteLocalVouchers } from '../lib/local-storage.ts';
import { getOrder } from '../lib/api';
import { retryHandler } from '../lib/error-handler';
import { createOrderHTML } from '../lib/utils';
import { pictureSizes } from '../../../_config/image-settings.mjs';
import { ClientOrder } from '../../../../shared/shared_types.mts';

const locale = document.documentElement.lang;
const container = document.getElementById('order')!;
const template = document.getElementById('order-item-template') as HTMLTemplateElement;
const productItemTemplate = document.getElementById('order-item-product-template') as HTMLTemplateElement;

const updateOrder = (order: ClientOrder) => {
  container.classList.remove('hidden');

  const clone = createOrderHTML(order, locale, pictureSizes.productXS, template, productItemTemplate);
  container.appendChild(clone);
}

const url = new URL(window.location.href);
const params = url.searchParams;
const redirectStatus = params.get("redirect_status");
if (redirectStatus === "succeeded") {
  // delete local cart and vouchers
  deleteLocalVouchers();
  destroy();

  // load order
  const paymentIntentId = params.get("payment_intent");
  if (paymentIntentId) {
    const orderRetryHandler = retryHandler(
      () => getOrder(paymentIntentId), {
        successHandler: (data) => {
          updateOrder(data.order)
        },
        removeRetryButtonOnSuccess: true
      }
    );
    orderRetryHandler.doAction();  
  }
}
window.addEventListener('DOMContentLoaded', () => {
  if (redirectStatus === "failed") {
    const dataElement = document.getElementById("order-thanks-data");
    if (dataElement && dataElement.dataset.checkoutPermalink) {
      window.location.href = dataElement.dataset.checkoutPermalink;
    }
  }
});
