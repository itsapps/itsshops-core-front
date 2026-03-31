import type { AddressInput } from './checkout-types'

type FieldError = { field: string; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class CheckoutForm {
  private form: HTMLFormElement
  private onCountryChange: ((country: string) => void) | null = null

  constructor(form: HTMLFormElement) {
    this.form = form
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
      errors.push({ field: 'contactEmail', message: 'Valid email required' })
    }

    const required: [string, string][] = [
      ['shipping.name', 'Name'],
      ['shipping.prename', 'First name'],
      ['shipping.lastname', 'Last name'],
      ['shipping.line1', 'Address'],
      ['shipping.zip', 'Postal code'],
      ['shipping.city', 'City'],
      ['shipping.country', 'Country'],
    ]

    for (const [field, label] of required) {
      if (!this.getFieldValue(field).trim()) {
        errors.push({ field, message: `${label} is required` })
      }
    }

    // Validate billing if separate
    const useShippingAsBilling = this.form.querySelector<HTMLInputElement>('[data-checkout-same-billing]')
    if (useShippingAsBilling?.checked === false) {
      const billingRequired: [string, string][] = [
        ['billing.name', 'Name'],
        ['billing.prename', 'First name'],
        ['billing.lastname', 'Last name'],
        ['billing.line1', 'Address'],
        ['billing.zip', 'Postal code'],
        ['billing.city', 'City'],
        ['billing.country', 'Country'],
      ]
      for (const [field, label] of billingRequired) {
        if (!this.getFieldValue(field).trim()) {
          errors.push({ field, message: `${label} is required` })
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
