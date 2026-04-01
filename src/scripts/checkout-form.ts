import type { AddressInput } from './checkout-types'

type FieldError = { field: string; message: string }

export type FormErrorLabels = {
  email: string
  prename: string
  lastname: string
  street: string
  city: string
  zip: string
  country: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class CheckoutForm {
  private form: HTMLFormElement
  private onCountryChange: ((country: string) => void) | null = null
  private errorLabels: FormErrorLabels

  constructor(form: HTMLFormElement, errorLabels?: FormErrorLabels) {
    this.form = form
    this.errorLabels = errorLabels ?? {
      email: 'Valid email required',
      prename: 'First name is required',
      lastname: 'Last name is required',
      street: 'Address is required',
      city: 'City is required',
      zip: 'Postal code is required',
      country: 'Country is required',
    }
    this.bindCountryListener()
    this.bindBillingToggle()
  }

  setOnCountryChange(fn: (country: string) => void): void {
    this.onCountryChange = fn
  }

  private bindBillingToggle(): void {
    const checkbox = this.form.querySelector<HTMLInputElement>('[data-checkout-same-billing]')
    const billingFields = this.form.querySelector<HTMLElement>('[data-checkout-billing-fields]')
    if (!checkbox || !billingFields) return

    checkbox.addEventListener('change', () => {
      billingFields.hidden = checkbox.checked
    })
  }

  private bindCountryListener(): void {
    const countrySelect = this.form.querySelector<HTMLSelectElement>('[data-checkout-country]')
    countrySelect?.addEventListener('change', () => {
      this.onCountryChange?.(countrySelect.value)
    })
  }

  getEmail(): string {
    return this.getFieldValue('contactEmail')
  }

  getCountry(): string {
    return this.getFieldValue('shipping.country') || this.getFieldValue('country') || ''
  }

  getShippingAddress(): AddressInput {
    const prename = this.getFieldValue('shipping.prename')
    const lastname = this.getFieldValue('shipping.lastname')
    return {
      name: `${prename} ${lastname}`.trim(),
      prename: this.getFieldValue('shipping.prename'),
      lastname: this.getFieldValue('shipping.lastname'),
      phone: this.getFieldValue('shipping.phone') || undefined,
      line1: this.getFieldValue('shipping.line1'),
      line2: this.getFieldValue('shipping.line2') || undefined,
      zip: this.getFieldValue('shipping.zip'),
      city: this.getFieldValue('shipping.city'),
      country: this.getFieldValue('shipping.country'),
      state: this.getFieldValue('shipping.state') || undefined,
    }
  }

  getBillingAddress(): AddressInput | undefined {
    const useShippingAsBilling = this.form.querySelector<HTMLInputElement>('[data-checkout-same-billing]')
    if (useShippingAsBilling?.checked !== false) return undefined

    const prename = this.getFieldValue('billing.prename')
    const lastname = this.getFieldValue('billing.lastname')
    return {
      name: `${prename} ${lastname}`.trim(),
      prename,
      lastname,
      phone: this.getFieldValue('billing.phone') || undefined,
      line1: this.getFieldValue('billing.line1'),
      line2: this.getFieldValue('billing.line2') || undefined,
      zip: this.getFieldValue('billing.zip'),
      city: this.getFieldValue('billing.city'),
      country: this.getFieldValue('billing.country'),
      state: this.getFieldValue('billing.state') || undefined,
    }
  }

  validate(): FieldError[] {
    const errors: FieldError[] = []

    const email = this.getEmail()
    if (!email || !EMAIL_RE.test(email)) {
      errors.push({ field: 'contactEmail', message: this.errorLabels.email })
    }

    const l = this.errorLabels
    const required: [string, string][] = [
      ['shipping.prename', l.prename],
      ['shipping.lastname', l.lastname],
      ['shipping.line1', l.street],
      ['shipping.zip', l.zip],
      ['shipping.city', l.city],
      ['shipping.country', l.country],
    ]

    for (const [field, message] of required) {
      if (!this.getFieldValue(field).trim()) {
        errors.push({ field, message })
      }
    }

    // Validate billing if separate
    const useShippingAsBilling = this.form.querySelector<HTMLInputElement>('[data-checkout-same-billing]')
    if (useShippingAsBilling?.checked === false) {
      const billingRequired: [string, string][] = [
        ['billing.prename', l.prename],
        ['billing.lastname', l.lastname],
        ['billing.line1', l.street],
        ['billing.zip', l.zip],
        ['billing.city', l.city],
        ['billing.country', l.country],
      ]
      for (const [field, message] of billingRequired) {
        if (!this.getFieldValue(field).trim()) {
          errors.push({ field, message })
        }
      }
    }

    return errors
  }

  showErrors(errors: FieldError[]): void {
    // Clear previous errors
    this.form.querySelectorAll('[data-checkout-error]').forEach(el => {
      el.textContent = ''
      el.removeAttribute('aria-live')
    })
    this.form.querySelectorAll('.is-invalid').forEach(el => {
      el.classList.remove('is-invalid')
    })

    for (const error of errors) {
      const errorEl = this.form.querySelector<HTMLElement>(`[data-checkout-error="${error.field}"]`)
      if (errorEl) {
        errorEl.textContent = error.message
        errorEl.setAttribute('aria-live', 'polite')
      }
      const input = this.form.querySelector<HTMLElement>(`[name="${error.field}"]`)
      input?.classList.add('is-invalid')
    }

    // Scroll to first error
    if (errors.length > 0) {
      const firstInput = this.form.querySelector<HTMLElement>(`[name="${errors[0].field}"]`)
      firstInput?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      firstInput?.focus()
    }
  }

  clearErrors(): void {
    this.showErrors([])
  }

  private getFieldValue(name: string): string {
    const el = this.form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)
    return el?.value ?? ''
  }
}
