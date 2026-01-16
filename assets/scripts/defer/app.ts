import { loginUser, logoutUser } from '../lib/api';
import {deleteLocalUser, setLocalUser, getLocalUser} from '../lib/local-storage';
import { formHandler, retryHandler } from '../lib/error-handler';
import { validateForm } from '../lib/form-validation';
import { add, update } from 'cart-localstorage' ;

console.groupCollapsed(
  '%c🍺 Site Credits',
  'display:block;padding:0.125em 4em;font-family:courier;font-size:24px;font-weight:bold;line-height:2;text-transform:uppercase;background:black;color:white;'
)
console.log(
  '%cDesign and Development by Thomas Heingärtner\nhttps://www.itsapps.at',
  'display:block;font-family:courier;font-size:19px;font-weight:bold;line-height:1;color:white;'
)
console.groupEnd()

// main menu dropdowns
const dropdownButtons = document.querySelectorAll(".mainnav--dropdown button") as NodeListOf<HTMLButtonElement>;
const closeOtherDropdownButtons = (currentButton: HTMLButtonElement) => {
  dropdownButtons.forEach((btn) => {
  // dropdownButtons.filter(btn => btn.parentNode != currentButton.parentNode).forEach((btn) => {
    if (btn != currentButton && btn.parentNode?.parentNode == currentButton.parentNode?.parentNode) {
      btn.setAttribute("aria-expanded", "false");
    }
  });
};
dropdownButtons.forEach((btn) => {
  btn.addEventListener("click", function () {
    const expanded = btn.getAttribute("aria-expanded") === "true" || false;
    btn.setAttribute("aria-expanded", !expanded ? "true" : "false");
    // closeOtherDropdownButtons(btn);
  });  
});

// login/logout
if (getLocalUser()) {
  retryHandler(
    () => logoutUser(), {
      completionHandler: (success, willRedirect) => {
        deleteLocalUser();
        if (!willRedirect) {
          window.location.reload();
        }
      },
      buttonId: 'logout-button'
    }
  );
} else {
  const login = async ({email, password}: {email: string, password: string}) => {
    return await formHandler(
      () => loginUser(email, password), {
        successHandler: (data) => {
          setLocalUser(data.user);
          window.location.reload();
        },
        // errorHandler: (error) => {
        //   console.log(error)
        // }
      }
    );
  };
  
  validateForm("sidebar-login-form", login);
}

// cart buttons
const sideCartButton = document.querySelector('[data-toggle-sidebar="sidecart"]') as HTMLButtonElement;
const handleAddToCart = async(button: HTMLButtonElement, counter: HTMLInputElement | null) => {
  const { type, id, price, title, image, variant, parent, path, bundleItems } = button.dataset;
  if (!id || !price || !title || !path || !type) {
    console.error("Missing dataset attributes");
    return;
  }

  const counterValue = counter?.value || "1";
  const lineQuantity = parseInt(counterValue, 10);
  const newQuantity = Math.max(1, lineQuantity)

  add({
    id,
    type: parseInt(type, 10),
    price: Number(price),
    title,
    image: image || "",
    variant: variant || "",
    parent: parent || "",
    path,
    bundleItems
  }, newQuantity);

  if (sideCartButton) {
    sideCartButton.click();
  } else {
    // no side cart, we are probably on the checkout page. so reload the page
    window.location.reload();
  }

  button.setAttribute('aria-live', "assertive");
  button.textContent = button.dataset.addedToCart!;
  setTimeout(() => {
    button.removeAttribute('aria-live');
    button.textContent = button.dataset.addToCart!;
  }, 3000);

  const event = new CustomEvent("cart:update", {});
  window.dispatchEvent(event);
}

const updateLineQuantity = (productId: string, counter: HTMLInputElement | null, increment: number) => {
  const counterValue = counter?.value || "1";
  const lineQuantity = parseInt(counterValue, 10);
  const newQuantity = Math.max(1, lineQuantity + increment)
  if (counter) {
    counter.value = `${newQuantity}`;
  }
  update(productId, 'quantity', newQuantity);
};
const updateInputLineQuantity = (productId: string, counter: HTMLInputElement) => {
  const counterValue = counter.value;
  const lineQuantity = parseInt(counterValue, 10);
  const newQuantity = Math.max(1, lineQuantity) 
  update(productId, 'quantity', newQuantity);
};

// query selector to get all elements where the class is add-to-cart
const cartButtons = document.querySelectorAll('[data-name="add-to-cart"]') as NodeListOf<HTMLButtonElement>;
cartButtons.forEach((button) => {
  const productId = button.dataset.id!;
  const stock = parseInt((button.dataset.stock || "0"), 10);

  if (stock > 0) {
    // counters
    const counterDown = document.querySelector(`[data-name="product-counter-down"][data-product-id="${productId}"]`);
    const counterUp = document.querySelector(`[data-name="product-counter-up"][data-product-id="${productId}"]`);
    const counterInput = document.querySelector(`[data-name="product-counter-input"][data-product-id="${productId}"]`) as HTMLInputElement | null;
    
    if (counterDown) {
      counterDown.addEventListener('click', () => {
        updateLineQuantity(productId, counterInput, -1);
      });
    }
    if (counterUp) {
      counterUp.addEventListener('click', () => {
        updateLineQuantity(productId, counterInput, 1);
      });
    }
    if (counterInput) {
      counterInput.addEventListener('change', () => {
        updateInputLineQuantity(productId, counterInput);
      });
    }

    button.removeAttribute("disabled");
    button.removeAttribute("aria-busy");
    button.addEventListener("click", () => {
      handleAddToCart(button, counterInput)
    });
  } else {
    button.setAttribute("disabled", "true");
    button.setAttribute("aria-busy", "false");
  }
});
