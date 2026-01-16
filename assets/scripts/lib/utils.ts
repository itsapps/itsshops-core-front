import {
  ClientOrder,
  ClientOrderProductItem,
  ClientOrderProductBundle,
} from '../../../../shared/shared_types.mjs';
import {
  PictureDefinition,
} from './client_types';
import {isBundleProduct} from '../../../../shared/enums.mjs';

export const localizeCurrencyNumber = (number: number, locale: string, currency="EUR") => {
  return (number).toLocaleString(locale, {
    style: "currency",
    currency: currency,
  });
};

export const formatDate = (
  dateString: string,
  locale: string,
  dateStyle: "full" | "long" | "medium" | "short" | undefined = "long",
  timeStyle?: "full" | "long" | "medium" | "short" | undefined) => {

  const options = {
    dateStyle: dateStyle,
    ...timeStyle && {timeStyle},
  }
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale || "en", options).format(date);
};

// export const fetchWithTimeout = async (resource, options = {}) => {
//   const { timeout = 8000 } = options;
  
//   const controller = new AbortController();
//   const id = setTimeout(() => controller.abort(), timeout);

//   const response = await fetch(resource, {
//     ...options,
//     signal: controller.signal  
//   });
//   clearTimeout(id);

//   return response;
// }

export const importWithTimeout = (path: string, timeout = 8000) => {
  return Promise.race([
    import(path),
    new Promise((_, reject) =>
      setTimeout(() => reject(), timeout)
    )
  ]);
};

export const postRequest = async (urlPath: string, payload={}) => {
  const response = await fetch(urlPath, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": document.documentElement.lang},
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  const data = await response.json();
  return data;
}

export const getRequest = async (urlPath: string) => {
  try {
    const response = await fetch(urlPath, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": document.documentElement.lang,
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}

export const updateBodyPadding = (shouldExpand: boolean) => {
  if (shouldExpand) {
    const getScrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = getScrollbarWidth+'px';  
  } else {
    document.body.style.paddingRight = '0';
  }
}

let toastTimeoutId: ReturnType<typeof setTimeout> | undefined;
export const showToast = (message: string, duration=3000) => {
  if (toastTimeoutId) {
    clearTimeout(toastTimeoutId);
  }

  const toast = document.getElementById("notification-toast");
  if (!toast) {
    return;
  }
  const innerDiv = toast.querySelector("div")!
  const p = innerDiv.querySelector("p")!

  const clickHandler = function({target}: {target: EventTarget | null}) {
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }

    target?.removeEventListener("click", clickHandler, false);
    toast.classList.remove("on")
    p.setAttribute("aria-disabled", "true");
  }

  p.innerHTML = message;
  innerDiv.addEventListener("click", clickHandler, false);
  p.setAttribute("aria-disabled", "false");
  
  toast.classList.add("on")
  if (duration >= 0) {
    toastTimeoutId = setTimeout(function(){
      innerDiv.removeEventListener("click", clickHandler, false);
      toast.classList.remove("on")
    }, duration);
  }
}

export const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export const userPrefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
export const smoothScrollIntoView = (htmlElement: HTMLElement, options: ScrollIntoViewOptions = {}) => {
  if (!htmlElement) return;
  const behaviour = userPrefersReducedMotion() ? 'auto' : 'smooth';
  htmlElement.scrollIntoView({ behavior: behaviour, ...options });
}
export const smoothScrollToPosition = (options?: ScrollToOptions) => {
  const behavior = userPrefersReducedMotion() ? 'auto' : 'smooth';
  window.scrollTo({ behavior, ...options });
}

export const toggleElement = (element: HTMLElement | undefined, visible: boolean) => {
  if (!element) {
    return
  }
  if (visible) {
    element.classList.remove("hidden");
  } else {
    element.classList.add("hidden");
  }
}

export const replacePicture = (
  picture: HTMLPictureElement,
  src: string,
  pictureDefinition: PictureDefinition,
  title: string,
  options: {
    classNames?: string
  } = {}
) => {
  const { classNames } = options;

  const sources = picture.querySelectorAll('source') as NodeListOf<HTMLSourceElement>;
  sources.forEach((source) => {
    // get format via source type and replace jpeg with jpg
    const format = source.type.split("/")[1].replace('jpeg', 'jpg');
    source.srcset = pictureDefinition.sizes.map(dimensions => {
      return `${src.replaceAll('{width}', `${dimensions[0]}`).replace('{height}', `${dimensions[1]}`).replace('{format}', format)} ${dimensions[0]}w`;
    }).join(', ');
    source.sizes = pictureDefinition.widths;

  });

  const img = picture.querySelector('img')
  if (img) {
    img.src = src.replaceAll('{width}', `${pictureDefinition.sizes[0][0]}`).replace('{height}', `${pictureDefinition.sizes[0][1]}`).replace('{format}', "jpg");
    img.width = pictureDefinition.sizes[0][0];
    img.height = pictureDefinition.sizes[0][1];
    img.alt = title;
    img.title = title;
    if (classNames) {
      img.className = classNames;
    }
  }
}

export const createOrderHTML = (order: ClientOrder, locale: string, pictureDefinition: PictureDefinition, template: HTMLTemplateElement, productItemTemplate: HTMLTemplateElement) => {
  const clone = template.content.cloneNode(true) as DocumentFragment;

  clone.querySelector('[data-name="date"]')!.textContent = formatDate(order.createdAt, locale, 'short', 'short')

  if (order.orderNumber) {
    clone.querySelector('[data-name="order-number"]')!.textContent = order.orderNumber
  } else {
    clone.querySelector('[data-name="order-number"]')?.parentElement?.remove()
  }
  if (order.statusText) {
    clone.querySelector('[data-name="status"]')!.textContent = order.statusText
  } else {
    clone.querySelector('[data-name="status"]')?.parentElement?.remove()
  }
  

  clone.querySelector('[data-name="total"]')!.textContent = localizeCurrencyNumber(order.total/100, locale)
  clone.querySelector('[data-name="subtotal"]')!.textContent = localizeCurrencyNumber(order.subtotal/100, locale)
  clone.querySelector('[data-name="tax"]')!.textContent = `${localizeCurrencyNumber(order.tax/100, locale)} (${order.taxRate}%)`
  clone.querySelector('[data-name="shipping"]')!.textContent = localizeCurrencyNumber(order.shippingRate/100, locale)
  clone.querySelector('[data-name="shipping-title"]')!.textContent = `(${order.shippingTitle})`
  if (order.discount) {
    clone.querySelector('[data-name="discount"]')?.append(localizeCurrencyNumber(-order.discount/100, locale))
  } else {
    clone.querySelector('[data-name="discount"]')?.parentElement?.remove()
  }

  const productList = clone.querySelector('[data-name="product-list"]')!
  order.items.map(item => {
    const itemClone = productItemTemplate.content.cloneNode(true) as DocumentFragment;
    if (item.image) {
      const picture = itemClone.querySelector('[data-name="photo"] picture') as HTMLPictureElement;
      if (picture) {
        replacePicture(picture, item.image, pictureDefinition, item.title);
      }
    }
    itemClone.querySelector('[data-name="name"]')!.textContent = `${item.quantity} x ${item.title}`;
    if (isBundleProduct(item.type)) {
      const productBundleItem = item as ClientOrderProductBundle
      itemClone.querySelector('[data-name="variant"]')!.textContent = productBundleItem.items.map(ii => `${ii.count} x ${ii.title}`).join(' / ');
    } else {
      const productItem = item as ClientOrderProductItem
      itemClone.querySelector('[data-name="variant"]')!.textContent = productItem.options.map(option => option.title).join(' / ');
    }
    itemClone.querySelector('[data-name="price"]')!.textContent = localizeCurrencyNumber(item.price*item.quantity/100, locale);

    productList.appendChild(itemClone);
  })

  // free products
  order.freeProducts.map(item => {
    const itemClone = productItemTemplate.content.cloneNode(true) as DocumentFragment;
    if (item.image) {
      const picture = itemClone.querySelector('[data-name="photo"] picture') as HTMLPictureElement;
      if (picture) {
        replacePicture(picture, item.image, pictureDefinition, item.title);
      }
    }
    itemClone.querySelector('[data-name="name"]')!.textContent = `${item.quantity} x ${item.title}`;
    itemClone.querySelector('[data-name="variant"]')!.remove();
    itemClone.querySelector('[data-name="price"]')!.textContent = localizeCurrencyNumber(0, locale);

    productList.appendChild(itemClone);
  })

  return clone;
}