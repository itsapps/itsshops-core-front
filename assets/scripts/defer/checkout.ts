import {
  AddressData,
  PartialAddress,
  CheckoutInputPayload,
  CheckoutCalculatePayment,
  CheckoutCreatePayment,
  ShippingRate,
  PaymentValidationErrorReason,
  Voucher,
  ShippingCountry,
  CartItem,
  CartBundleItem,
  BundleItem,
} from '../../../../shared/shared_types.mts';
import {LocalStorageCartBundleItemParsed} from '../lib/client_types';
import {isBundleProduct} from '../../../../shared/enums.mjs';
import { calculatePayment, createPaymentIntent, JsonRequestResult } from '../lib/api.ts';
import { showServiceError, hideServiceError} from '../lib/error-handler.ts';
import { ValidationError, IOError, ClientError } from '../lib/browser-errors.ts';
import { LocalCart } from "../lib/checkout_cart.ts";
import {
  Stripe,
  StripeElements,
  StripePaymentElement,
  StripeExpressCheckoutElement,
  Appearance,
  StripeElementLocale,
  ConfirmPaymentData,
  ShippingAddress,
  ClickResolveDetails,
  ChangeResolveDetails,
  PaymentIntentConfirmParams,
  loadStripe,
  StripeError,
  ExpressCheckoutPartialAddress,
  LineItem,
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementShippingAddressChangeEvent,
  StripeExpressCheckoutElementShippingRateChangeEvent,
  StripeExpressCheckoutElementConfirmEvent,
} from '@stripe/stripe-js';
import {getLocalUser, getLocalVouchers, setLocalVouchers} from '../lib/local-storage.ts';
import { toggleElement, showToast, smoothScrollIntoView, localizeCurrencyNumber } from '../lib/utils.ts';
import { createTranslator, BrowserTranslations } from '../lib/translation.ts';
import { LocalVoucher } from '../lib/client_types';
import { FormValidator } from '../lib/form-validation.ts';
// import Stripe from 'stripe';

type ConfirmPaymentDataWithoutReturnUrl = Omit<ConfirmPaymentData, 'return_url'>;

const translations: BrowserTranslations = {
  en: {
    shipping: "Shipping",
    discount: "Discount",
    voucherAlreadyAdded: "Voucher already added",
    voucherNotFound: "Voucher not found",
    voucherFound: "Voucher added to cart",
    itemsChanged: "Cart has changed",
    empty: "Your Cart is empty.",
  },
  de: {
    shipping: "Versand",
    discount: "Ermäßigung",
    voucherAlreadyAdded: "Dieser Gutschein wurde bereits hinzugefügt",
    voucherNotFound: "Dieser Gutschein wurde nicht gefunden",
    voucherFound: "Gutschein wurde zum Warenkorb hinzugefügt",
    itemsChanged: "Der Warenkorb hat sich geändert",
    empty: "Dein Warenkorb ist leer.",
  }
}
const t = createTranslator(translations);

class Checkout {
  private formContainer: HTMLElement;
  private form: HTMLFormElement;
  private countrySelect: HTMLSelectElement;
  private shippingMethodContainer: HTMLElement;
  private shippingMethodItemTemplate: HTMLTemplateElement;
  private checkoutElementContainers: NodeListOf<HTMLElement>;
  private formValidator!: FormValidator;
  private isSubmitting: boolean = false;
  private submitButton: HTMLButtonElement;
  private voucherArea: HTMLElement;
  private checkoutFooter: HTMLElement;
  private voucherForm: HTMLFormElement;
  private voucherButton: HTMLButtonElement;
  private voucherInput: HTMLInputElement;
  private successUrl: string;
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private paymentElement: HTMLElement;
  private stripePaymentElement: StripePaymentElement | null = null;
  private expressCheckoutElement: StripeExpressCheckoutElement | null = null;
  private themeObserver: MutationObserver | null = null;
  private allowedShippingCountryCodes: string[];
  private stripePublishableApiKey: string | null = null;
  private cart: LocalCart;
  private vouchers: LocalVoucher[] = [];
  private lastExpressCheckoutAddress: PartialAddress | undefined;
  private lastExpressCheckoutShippingRate: ShippingRate | undefined;
  private currentShippingRates: ShippingRate[] | undefined = undefined;
  private orderMetaId: string | undefined = undefined;
  private lastDiscount: number | null = null;

  private initializeHandler = (event: Event) => this.initialize(event);
  private submitFormHandler = (event: Event) => this.submitForm(event);
  private addVoucherCodeHandler = (event: Event) => this.addVoucherCode(event);
  private shippingMethodChangedHandler = (event: Event) => this.changedShippingMethod(event);
  private formCountryChangeHandler = (event: Event) => {
    const countrySelect = event.target as HTMLSelectElement;
    const value = countrySelect.value;
    if (value) {
      this.standardCheckoutChangedEvent('shipping_address_change', value);
    }
  }

  constructor() {
    this.formContainer = document.getElementById('checkout-elements-address-form-container')!;
    const form_id = this.formContainer.dataset.formId!
    this.paymentElement = document.getElementById('payment-element')!;
    this.checkoutElementContainers = document.querySelectorAll('[id^="checkout-elements"]')

    const cartElement = document.getElementById('checkout-cart')!;
    this.successUrl = cartElement.dataset.checkoutSuccessUrl!;
    this.stripePublishableApiKey = cartElement.dataset.stripePublishableApiKey!
    if (!this.stripePublishableApiKey) {
      console.error("stripePublishableApiKey is not set");
      return;
    }

    const shippingCountriesSettings = cartElement.dataset.supportedShippingCountryCodes!
    this.allowedShippingCountryCodes = shippingCountriesSettings.split(',');

    this.shippingMethodContainer = document.getElementById('shipping-methods')!;
    this.shippingMethodItemTemplate = document.getElementById('checkout-shipping-method-template')! as HTMLTemplateElement;

    this.handleUpdateCart = this.handleUpdateCart.bind(this);
    this.handleVoucherRemove = this.handleVoucherRemove.bind(this);
    this.cart = new LocalCart("checkout-cart", {
      onUpdate: this.handleUpdateCart,
      onVoucherRemove: this.handleVoucherRemove
    });
    this.vouchers = getLocalVouchers();

    this.form = document.getElementById(form_id) as HTMLFormElement;
    this.countrySelect = this.form.querySelector('select[name="country"]') as HTMLSelectElement

    this.submitButton = document.getElementById(form_id+"-submit") as HTMLButtonElement;
    this.voucherArea = document.getElementById("checkout-voucher-area") as HTMLButtonElement;
    this.voucherForm = document.getElementById("checkout-voucher-form") as HTMLFormElement;
    this.voucherButton = document.getElementById("add-voucher-button") as HTMLButtonElement;
    this.voucherInput = document.getElementById("voucher-code-input") as HTMLInputElement;
    this.checkoutFooter = document.getElementById("checkout-cart-footer") as HTMLElement;
    
    // initially disable form submit, and let submitButton handle retries
    // this.form.addEventListener("submit", (e) => e.preventDefault());

    // early dropout if cart is empty
    if (!this.cart.isValid()) {
      this.toggleAllCheckoutElements(false);
      this.cart.render();
      return
    }
    
    // this.submitButton.addEventListener("click", (event) => {
    //   this.initialize(event)
    // });

    this.submitButton.addEventListener("click", this.initializeHandler);

    this.voucherForm.addEventListener("submit", this.addVoucherCodeHandler);
    this.voucherButton.addEventListener("click", this.addVoucherCodeHandler);
    this.voucherInput.addEventListener("input", () => this.voucherButton.disabled = this.voucherInput.value === '');
    this.shippingMethodContainer.addEventListener('change', this.shippingMethodChangedHandler);
    
    this.initialize();
  }

  private async initialize(event?: Event) {
    event?.preventDefault();
    if (this.isSubmitting) return;

    this.setLoading(true, 'submit');
    const {data, errorData} = await this.calculateCheckout({});
    this.setLoading(false, 'submit');
    if (data) {
      this.formValidator = new FormValidator(this.form);
      this.toggleAllCheckoutElements(true);

      // register form submit handlers
      this.form.addEventListener("submit", this.submitFormHandler);
      this.submitButton.addEventListener("click", this.submitFormHandler);

      // remove initialize handler
      this.submitButton.removeEventListener("click", this.initializeHandler);

      // register country change handler
      this.countrySelect.addEventListener("change", this.formCountryChangeHandler);
    } else {
      if (errorData) {
        console.log(errorData);
      }
    }
  }

  private getCheckoutPayload({addressData, partialAddress, shippingRateId, orderMetaId, voucherCode}:
    {addressData?: AddressData, partialAddress?: PartialAddress, shippingRateId?: string, orderMetaId?: string, voucherCode?: string} = {}
  ): CheckoutInputPayload {
    const user = getLocalUser();
    const payload: CheckoutInputPayload = {
      userId: user?.id,
      ...addressData && {addressData},
      ...partialAddress && {partialAddress},
      ...shippingRateId && {shippingRateId},
      ...orderMetaId && {orderMetaId},
      cart: {
        items: this.cart.getItems().map(item => {
          if (!isBundleProduct(item.type)) {
            const i: CartItem = {
              type: item.type,
              id: item.id,
              quantity: item.quantity,
              ...item.parent && {parent: item.parent},
            }
            return i
          } else {
            const bundleItems: LocalStorageCartBundleItemParsed[] = item.bundleItems ? JSON.parse(item.bundleItems) : [];
            const i: CartBundleItem = {
              type: item.type,
              id: item.id,
              quantity: item.quantity,
              ...item.parent && {parent: item.parent},
              items: bundleItems.map(bundleItem => {
                const ii: BundleItem = {
                  type: bundleItem.type,
                  productId: bundleItem.productId,
                  parentId: bundleItem.parentId,
                  count: bundleItem.count
                }
                return ii
              })
            }
            return i
          }
        })
      },
      vouchers: {
        selectedIds: this.vouchers.filter(v => !v.disabled).map(v => v.id),
        disabledIds: this.vouchers.filter(v => v.disabled).map(v => v.id),
        codes: voucherCode ? [voucherCode] : []
      }
    }
    return payload;
  }

  private async calculateCheckout({partialAddress, shippingRateId, voucherCode}:
    {partialAddress?: PartialAddress, shippingRateId?: string, voucherCode?: string}):
    Promise<{data?: CheckoutCalculatePayment, errorData?: {message: string, errorFields?: Record<string, string>}}> {
      hideServiceError();
      const result = await calculatePayment(this.getCheckoutPayload({partialAddress, shippingRateId, voucherCode}));
      return this.handleResponse(result);
  }
  
  private async createPayment({addressData, shippingRateId}:
    {addressData: AddressData, shippingRateId: string}):
    Promise<{data?: CheckoutCreatePayment, errorData?: {message: string, errorFields?: Record<string, string>}}> {
      hideServiceError();
      const result = await createPaymentIntent(this.getCheckoutPayload({addressData, shippingRateId, orderMetaId: this.orderMetaId}));
      return this.handleResponse(result, false) as Promise<{data?: CheckoutCreatePayment, errorData?: {message: string, errorFields?: Record<string, string>}}>;
  }

  private async handleResponse(result: JsonRequestResult<CheckoutCalculatePayment | CheckoutCreatePayment>, updatePaymentElements: boolean = true):
    Promise<{data?: CheckoutCalculatePayment | CheckoutCreatePayment, errorData?: {message: string, errorFields?: Record<string, string>}}> {
    if (result.success) {
      const data = result.data;

      const cartChanged = this.cart.updateItems(data);
      if (!this.cart.isValid()) {
        this.cart.render();
        this.toggleAllCheckoutElements(false);
        return {errorData: {
          message: t('empty'),
        }};
      }
      

      // this.currentShippingRates = [...data.shippingRates].sort((a, b) => {
      //   return a.id === data.selectedShippingRateId ? -1 : b.id === data.selectedShippingRateId ? 1 : 0;
      // });
      this.currentShippingRates = [...data.shippingRates]
      this.lastDiscount = data.discount || null;
      const shippingAmount = this.currentShippingRates.find(x => x.id === data.selectedShippingRateId)?.amount || 0;

      this.updateShippingMethods(
        data.shippingRates,
        data.selectedShippingRateId,
        data.supportedShippingCountries,
        data.selectedShippingCountry
      );
      // map vouchers and store in localeStorage
      this.vouchers = data.vouchers.map(v => {
        const voucher: LocalVoucher = {
          id: v.id,
          code: v.code,
          disabled: v.disabled
        };
        return voucher
      });
      setLocalVouchers(this.vouchers);

      this.cart.render({
        shipping: shippingAmount/100,
        tax: data.tax/100,
        taxRate: data.taxRate,
        subtotal: data.subtotal/100,
        ...data.discount && {discount: data.discount/100},
        total: data.total/100,
        vouchers: data.vouchers,
      });

      if (cartChanged) {
        if ("orderMetaId" in data) {
          this.orderMetaId = data.orderMetaId
        }

        showToast(t('itemsChanged'), -1);
        return {data, errorData: {
          message: t('itemsChanged')
        }};
      }

      if (updatePaymentElements) {
        this.initializeStripe(data.total);
      }

      return {data};
    } else {
      const error = result.data;
      if (error instanceof ValidationError) {
        const errorFields = error.meta.fields as Record<string, string>;
        const validationReason = error.meta.reason
        if (validationReason) {
          if (validationReason == PaymentValidationErrorReason.noValidProducts) {
            this.cart.clear();
            this.cart.render();
            this.toggleAllCheckoutElements(false);
          }
        }
        showToast(error.message, -1);
        return {errorData: {
          message: error.message,
          ...errorFields && {errorFields}
        }};
      }
      else if (error instanceof IOError) {
        showServiceError(error);
      }
      else if (error instanceof ClientError) {
        showToast(error.message, -1);
      }
      
      return {errorData: {message: error.message}};
    }
  }

  private async confirmPayment(clientSecret: string, confirmParams: ConfirmPaymentDataWithoutReturnUrl):
    Promise<StripeError | Error | null> {
    try {
      const confirmation = await this.stripe!.confirmPayment({
        elements: this.elements!,
        clientSecret,
        confirmParams: {
          ...confirmParams,
          return_url: this.successUrl!,
        },
      });
      if (confirmation.error) {
        return confirmation.error;
      }
      return null;
    } catch (err) {
      const error = err as Error
      // if (error.type === "card_error") {
      //   return {message: error.message};
      // }
      // if (error.type === "validation_error") {
      //   return {message: "Invalid data"};
      // }
      // else {
      //   return {message: "An unexpected error occurred."};
      // }
      return error
    }
  }

  private async submitForm(event: Event) {
    event.preventDefault();

    if (this.isSubmitting) return;

    const {valid, invalidFields} = this.formValidator.validateAll();
    if (!valid) {
      // showToast("checkout.validationError", 10000);
      smoothScrollIntoView(invalidFields?.[0], { block: 'center' });
      return;
    }

    const elementSubmit = await this.elements!.submit();
    if (elementSubmit.error) {
      // showToast(elementSubmit.error.message, 7000);
      smoothScrollIntoView(this.paymentElement, { block: 'start' });
      return;
    }

    const formData = this.formValidator.getFormData();

    const shippingRateId = this.getSelectedShippingMethod()
    const addressData: AddressData = {
      email: formData.email,
      shipping: {
        name: formData.prename + " " + formData.lastname,
        prename: formData.prename,
        lastname: formData.lastname,
        city: formData.city,
        country: formData.country || 'AT',
        line1: formData.street + " " + formData.streetnumber,
        zip: formData.zip,
        ...formData.state && {state: formData.state}
      },
      ...(formData['no-billing-address'] === undefined) && {
        billing: {
          name: formData.billing_prename + " " + formData.billing_lastname,
          prename: formData.billing_prename,
          lastname: formData.billing_lastname,
          city: formData.billing_city,
          country: formData.billing_country || 'AT',
          line1: formData.billing_street + " " + formData.billing_streetnumber,
          zip: formData.billing_zip,
          ...formData.billing_state && {state: formData.billing_state}
        }
      }
    }
    const shipping: PaymentIntentConfirmParams.Shipping = {
      name: addressData.shipping.name,
      address: {
        city: addressData.shipping.city,
        country: addressData.shipping.country,
        line1: addressData.shipping.line1,
        ...addressData.shipping.line2 && {line2: addressData.shipping.line2},
        state: addressData.shipping.state || '',
        postal_code: addressData.shipping.zip,
      }
    };
    const billing: ShippingAddress | null = addressData.billing ? {
      name: addressData.billing.name,
      address: {
        city: addressData.billing.city,
        country: addressData.billing.country,
        line1: addressData.billing.line1,
        line2: addressData.billing.line2 || null,
        state: addressData.billing.state || '',
        postal_code: addressData.billing.zip,
      }
    } : null;
    const confirmParams: ConfirmPaymentDataWithoutReturnUrl = {
      payment_method_data: {
        billing_details: {
          email: addressData.email,
          ...(billing ? {...billing} : {...shipping})
        }
      },
      shipping
    };

    this.setLoading(true, 'submit');
    const {data, errorData} = await this.createPayment({addressData, shippingRateId});
    if (data && !errorData) {
      // confirm payment
      const error = await this.confirmPayment(data.clientSecret, confirmParams);
      if (error) {
        showToast(error.message || "Stripe: An unexpected error occurred.", -1);
        this.initializeStripe(data.total);
      }
    } else if (errorData && errorData.errorFields) {
      this.formValidator.setValidationErrors(errorData.errorFields);
    }
    this.setLoading(false, 'submit');
  }

  private setLoading(isLoading: boolean, button: 'submit' | 'voucher' | undefined = undefined) {
    this.isSubmitting = isLoading;
    if (isLoading) {
      if (button === 'submit') {
        this.submitButton.dataset.loading = 'true';
      } else if (button === 'voucher') {
        this.voucherButton.dataset.loading = 'true';
      }
    } else {
      this.submitButton.dataset.loading = 'false';
      this.voucherButton.dataset.loading = 'false';
    }
    
    this.submitButton.disabled = isLoading;
    this.voucherButton.disabled = isLoading || this.voucherInput.value === '';

    // endable/disable all other inputs/buttons
    this.cart.setLoading(isLoading);

    const formElements = this.form.querySelectorAll('select, input') as NodeListOf<HTMLButtonElement | HTMLInputElement>
    formElements.forEach(disableable => {
      disableable.disabled = isLoading
    })
    if (this.stripePaymentElement) {
      this.stripePaymentElement.update({readOnly: true});
    }
  }

  private toggleAllCheckoutElements(toVisible: boolean) {
    this.togglePaymentForm(toVisible);
    toggleElement(this.formContainer, toVisible);
    toggleElement(this.voucherArea, toVisible);
    toggleElement(this.checkoutFooter, toVisible);
    if (!toVisible) {
      this.submitButton.remove();
      // toggleElement(this.submitButton, toVisible);
    }
  }

  private togglePaymentForm(visible: boolean) {
    [...this.checkoutElementContainers].forEach(element => {
      toggleElement(element, visible);  
    })
  }

  private async handleUpdateCart(id: string) {
    if (!this.cart.isValid()) {
      this.cart.render();
      this.toggleAllCheckoutElements(false);
      return;
    }

    this.setLoading(true);
    await this.calculateCheckout(this.getMinimalCalculationData());
    this.setLoading(false);
  }

  private async addVoucherCode(event: Event) {
    event.preventDefault();
    
    const code = this.voucherInput.value;
    if (code) {
      const voucher = this.vouchers.find(v => v.code === code);
      if (voucher) {
        showToast(t('voucherAlreadyAdded'), 7000);
        return;
      }
      
      this.setLoading(true, 'voucher');
      const {data, errorData} = await this.calculateCheckout({
        ...this.getMinimalCalculationData(),
        voucherCode: code
      });
      this.setLoading(false, 'voucher');

      // check if voucher with code was found
      if (!errorData) {
        if (data?.vouchers) {
          const voucher = data.vouchers.find(voucher => voucher.code === code);
          if (voucher) {
            this.voucherInput.value = '';
            this.voucherButton.disabled = true;
            showToast(t('voucherFound'), 7000);
            return
          }
        }
        showToast(t('voucherNotFound'), 7000);
      }
    }
  }

  private async handleVoucherRemove(voucher: Voucher) {
    const storedVoucher = this.vouchers.find(v => v.id === voucher.id);
    if (!storedVoucher) return;
    // automatic vouchers have no code. we need to disable it so it won't be added again
    if (!storedVoucher.code) {
      storedVoucher.disabled = !voucher.disabled;
    } else {
      this.vouchers = this.vouchers.filter(v => v.id !== voucher.id);
    }
    this.setLoading(true);
    await this.calculateCheckout(this.getMinimalCalculationData());
    this.setLoading(false);
  }

  private getMinimalCalculationData(): {partialAddress: PartialAddress, shippingRateId: string | undefined} {
    const formData = this.formValidator.getFormData();
    const shippingRateId = this.getSelectedShippingMethod()
    const partialAddress: PartialAddress = {
      country: formData.country || 'AT',
    }
    return {partialAddress, shippingRateId}
  }

  private getSelectedShippingMethod(): string {
    const checkedShippingMethod = this.shippingMethodContainer.querySelector('input:checked') as HTMLInputElement;
    return checkedShippingMethod?.value || this.currentShippingRates?.[0]?.id || '';
  }

  private async changedShippingMethod(event: Event) {
    this.setLoading(true, 'submit');
    await this.calculateCheckout(this.getMinimalCalculationData());
    this.setLoading(false, 'submit');
  }
  
  private updateShippingMethods(
    shippingRates: ShippingRate[],
    selectedRateId: string,
    supportedShippingCountries: ShippingCountry[],
    selectedShippingCountry: string
  ) {
    // this.currentShippingRates = shippingRates;
    this.shippingMethodContainer.innerHTML = '';
    shippingRates.forEach((shippingRate) => {
      const clone = this.shippingMethodItemTemplate.content.cloneNode(true) as HTMLElement;
      const inputId = `shipping-rate-${shippingRate.id}`
      const label = clone.querySelector('label')!
      label.textContent = `${shippingRate.displayName} (${localizeCurrencyNumber(shippingRate.amount/100, document.documentElement.lang)})`;
      label.setAttribute('for', inputId);
      const input = clone.querySelector('input')!
      input.setAttribute('value', shippingRate.id);
      input.setAttribute('id', inputId);

      if (shippingRate.id === selectedRateId) {
        input.checked = true;
      }
      this.shippingMethodContainer.appendChild(clone);
    })

    // update country selects in address data form
    const countryField = this.form.querySelector('select[name="country"]') as HTMLSelectElement
    countryField.innerHTML = '';
    supportedShippingCountries.forEach(country => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = country.title;
      if (country.code === selectedShippingCountry) {
        option.selected = true;
      }
      countryField.appendChild(option);
    })

    const billingCountryField = this.form.querySelector('select[name="billing_country"]') as HTMLSelectElement
    const selectedCountryCode = billingCountryField.value || selectedShippingCountry;
    billingCountryField.innerHTML = '';
    supportedShippingCountries.forEach(country => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = country.title;
      if (country.code === selectedCountryCode) {
        option.selected = true;
      }
      billingCountryField.appendChild(option);
    })
  }

  private async expressCheckoutClick(event: StripeExpressCheckoutElementClickEvent) {
    const lineItems: LineItem[] = [];
    this.cart.getItems().forEach((item) => {
      lineItems.push({
        name: `${item.quantity}x ${item.title}`,
        amount: item.price * item.quantity
      })
    })
    const shippingRate = this.currentShippingRates?.[0]
    if (shippingRate) {
      lineItems.push({
        name: `${t('shipping')} (${shippingRate.displayName})`,
        amount: shippingRate.amount
      })
    }
    if (this.lastDiscount) {
        lineItems.push({
          name: t('discount'),
          amount: -this.lastDiscount
        })  
      }
    const options: ClickResolveDetails = {
      shippingRates: this.currentShippingRates,
      lineItems: lineItems
    };
    event.resolve(options);
  }

  private async standardCheckoutChangedEvent(
    eventType: 'shipping_address_change' | 'shipping_rate_change',
    value: string,
  ) {
    let partialAddress: PartialAddress | undefined = undefined;
    let shippingRateId: string | undefined = undefined;

    if (eventType === 'shipping_address_change') {
      partialAddress = {
        country: value,
      }
    } else {
      shippingRateId = value;
    }

    this.setLoading(true, 'submit');
    await this.calculateCheckout({partialAddress, shippingRateId});
    this.setLoading(false, 'submit');
  }

  private async expressCheckoutChangedEvent(
    eventType: 'shipping_address_change' | 'shipping_rate_change',
    event: StripeExpressCheckoutElementShippingAddressChangeEvent | StripeExpressCheckoutElementShippingRateChangeEvent,
  ) {
    let partialAddress: PartialAddress | undefined = undefined;
    let shippingRateId: string | undefined = undefined;

    if (eventType === 'shipping_address_change') {
      const shippingAddress: ExpressCheckoutPartialAddress = (event as StripeExpressCheckoutElementShippingAddressChangeEvent).address;
      partialAddress = {
        city: shippingAddress.city,
        country: shippingAddress.country,
        zip: shippingAddress.postal_code,
        ...shippingAddress.state && {state: shippingAddress.state}
      }
      this.lastExpressCheckoutAddress = partialAddress;

      shippingRateId = this.lastExpressCheckoutShippingRate?.id
    } else {
      const shippingRate: ShippingRate = (event as StripeExpressCheckoutElementShippingRateChangeEvent).shippingRate;
      shippingRateId = shippingRate.id

      this.lastExpressCheckoutShippingRate = shippingRate;

      partialAddress = this.lastExpressCheckoutAddress
    }

    const {data, errorData} = await this.calculateCheckout({partialAddress, shippingRateId});
    if (!data && errorData) {
      event.reject();
      return
    }
    if (data) {
      const lineItems: LineItem[] = [];
      this.cart.getItems().forEach((item) => {
        const i = data.items.find(i => i.id === item.id);
        if (!i) {
          showToast(t('itemsChanged'), -1);
          event.reject();
          return
        }
        lineItems.push({
          name: `${item.quantity}x ${item.title}`,
          amount: i.price * i.quantity
        })
      })
      const shippingRate = data.shippingRates.find(x => x.id === data.selectedShippingRateId);
      if (shippingRate) {
        lineItems.push({
          name: `${t('shipping')} (${shippingRate.displayName})`,
          amount: shippingRate.amount
        })
      }
      if (data.discount) {
        lineItems.push({
          name: t('discount'),
          amount: -data.discount
        })  
      }
      

      const options: ChangeResolveDetails = {
        shippingRates: data.shippingRates,
        lineItems
      }
      // elements!.update({ amount: data.total });
      event.resolve(options);
    } else {
      event.reject();
    }
  }

  private async expressCheckoutConfirm(handler: StripeExpressCheckoutElementConfirmEvent) {
    // if (!handler.shippingAddress) {
    //   handler.paymentFailed({
    //     reason: "invalid_shipping_address",
    //     message: "Invalid shipping address"
    //   });
    //   return;
    // }
    const shippingRateId = handler.shippingRate?.id;
    if (!shippingRateId) {
      handler.paymentFailed({
        reason: "fail",
        message: "No shipping rate selected"
      });
      return;
    }

    const shippingAddress = handler.shippingAddress!;

    if (!handler.billingDetails?.email) {
      handler.paymentFailed({
        reason: "fail",
        message: "No email address"
      });
      return;
    }
    const email = handler.billingDetails!.email;

    const name = shippingAddress.name;
    const parts = name.trim().split(' ');
    const splitName = {
      prename: name,
      lastname: name
    }
    if (parts.length >= 2) {
      splitName.prename = [...parts].splice(0, 1).join(' ');
      splitName.lastname = [...parts].splice(1).join(' ');
    }

    // this is the address data that we validate against in our payment_create server function
    // we use shipping as the default address for shipping and billing
    const addressData: AddressData = {
      email,
      shipping: {
        name: name,
        prename: splitName.prename,
        lastname: splitName.lastname,
        city: shippingAddress.address.city,
        country: shippingAddress.address.country,
        line1: shippingAddress.address.line1,
        line2: shippingAddress.address.line2 || undefined,
        zip: shippingAddress.address.postal_code,
        ...shippingAddress.address.state && {state: shippingAddress.address.state}
      }
    }

    // we use shipping address as the billing address that we send to stripe
    const shipping: PaymentIntentConfirmParams.Shipping = {
      name: addressData.shipping.name,
      phone: addressData.shipping.phone,
      address: {
        city: addressData.shipping.city,
        country: addressData.shipping.country,
        line1: addressData.shipping.line1,
        line2: addressData.shipping.line2 || undefined,
        state: addressData.shipping.state || '',
        postal_code: addressData.shipping.zip,
      }
    };

    const confirmParams: ConfirmPaymentDataWithoutReturnUrl = {
      payment_method_data: {
        billing_details: {
          email: addressData.email,
          ...shipping
        },
      },
      shipping
    };
  
    
    const {data, errorData} = await this.createPayment({addressData, shippingRateId});
    if (errorData) {
      handler.paymentFailed({
        reason: errorData.errorFields ? "invalid_shipping_address" : "fail",
        message: errorData.message
      });
      return
    }
    if (data) {
      // confirmPayment
      const error = await this.confirmPayment(data.clientSecret, confirmParams);
      if (error) {
        handler.paymentFailed({
          reason: "fail",
          message: error.message
        });
        // showToast(error.message, -1);
      }
    }
  }

  private async initializeStripe(amount: number) {
    if (this.stripe) {
      requestAnimationFrame(() => {
        this.elements!.update({ amount });
        this.stripePaymentElement!.unmount();
        this.stripePaymentElement!.mount('#payment-element');
      });
      // this.paymentElement.remove();
      // const paymentElementContainer = document.getElementById('checkout-elements-stripe');
      // paymentElementContainer!.appendChild(this.paymentElement);
      return;
    }

    this.stripe = await loadStripe(this.stripePublishableApiKey!);

    // const elements = this.stripe.elements();
    this.elements = this.stripe!.elements({
      mode: "payment",
      amount: amount,
      currency: "eur",
      appearance: this.getStripeAppearance(),
      locale: document.documentElement.lang as StripeElementLocale,
    });

    //observe theme changes
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }
    this.observeThemeChanges(this.elements);

    // payment
    requestAnimationFrame(() => {
      this.stripePaymentElement = this.elements!.create("payment", {
        layout: "tabs",
      });
      this.stripePaymentElement.mount('#payment-element');
    });

    // express checkout
    this.expressCheckoutElement = this.elements.create('expressCheckout', {
      paymentMethods: {
        amazonPay: 'never',
        link: 'never',
        paypal: 'never'
      },
      emailRequired: true,
      shippingAddressRequired: true,
      allowedShippingCountries: this.allowedShippingCountryCodes
    });
    this.expressCheckoutElement.mount('#express-checkout-element');
    
    this.expressCheckoutElement.on('click', async(event: StripeExpressCheckoutElementClickEvent) => {
      console.log("expressCheckoutElement click");
      return this.expressCheckoutClick(event);
    });

    this.expressCheckoutElement.on('shippingaddresschange', async(event) => {
      console.log("expressCheckoutElement shippingaddresschange");
      this.expressCheckoutChangedEvent('shipping_address_change', event);
    });

    this.expressCheckoutElement.on('shippingratechange', async(event) => {
      console.log("expressCheckoutElement shippingratechange");
      this.expressCheckoutChangedEvent('shipping_rate_change', event);
    })
    
    this.expressCheckoutElement.on('confirm', async(handler) => {
      console.log("expressCheckoutElement confirm");
      this.expressCheckoutConfirm(handler);
    });

    this.expressCheckoutElement.on('cancel', async(handler) => {
      console.log("expressCheckoutElement cancel");
      this.lastExpressCheckoutAddress = undefined;
      this.lastExpressCheckoutShippingRate = undefined;
      // if the user cancels the express checkout, we want to switch back to the standard checkout
      this.standardCheckoutChangedEvent('shipping_address_change', this.countrySelect.value);
    });
  }

  private observeThemeChanges(elements: StripeElements) {
    const htmlElement = document.documentElement;
    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "data-theme") {
          // const newTheme = htmlElement.getAttribute("data-theme");
          // const value = newTheme === 'dark' ? 'night' : 'stripe';
          console.log("update appearance");
          elements.update({ appearance: this.getStripeAppearance() });
        }
      });
    });
    this.themeObserver.observe(htmlElement, { attributes: true });
  }

  private getStripeAppearance(): Appearance {
    const theme = document.documentElement.getAttribute('data-theme');
    return {
      theme: theme === 'dark' ? 'night' : 'stripe'
    }
  }
}
new Checkout();
