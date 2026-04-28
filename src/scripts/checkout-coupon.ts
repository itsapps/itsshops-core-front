import type { AppliedCouponResponse, CouponErrorResponse } from '../shared/checkout-api'

export type CouponLabels = {
  apply: string
  remove: string
  applied: string
  errors: Record<string, string>
  errorFallback: string
}

export type CouponEvents = {
  /** Fired when the user submits a code. Caller should recalculate with that code. */
  onApply: (code: string) => void
  /** Fired when the user clicks remove. Caller should recalculate without a code. */
  onRemove: () => void
}

export class CheckoutCoupon {
  private container: HTMLElement
  private input: HTMLInputElement | null
  private applyBtn: HTMLButtonElement | null
  private removeBtn: HTMLButtonElement | null
  private errorEl: HTMLElement | null
  private appliedEl: HTMLElement | null
  private appliedCodeEl: HTMLElement | null
  private labels: CouponLabels
  private events: CouponEvents | null = null

  constructor(container: HTMLElement, labels: CouponLabels) {
    this.container = container
    this.input = container.querySelector<HTMLInputElement>('[data-checkout-coupon-input]')
    this.applyBtn = container.querySelector<HTMLButtonElement>('[data-checkout-coupon-apply]')
    this.removeBtn = container.querySelector<HTMLButtonElement>('[data-checkout-coupon-remove]')
    this.errorEl = container.querySelector<HTMLElement>('[data-checkout-coupon-error]')
    this.appliedEl = container.querySelector<HTMLElement>('[data-checkout-coupon-applied]')
    this.appliedCodeEl = container.querySelector<HTMLElement>('[data-checkout-coupon-applied-code]')
    this.labels = labels

    this.applyBtn?.addEventListener('click', (e) => {
      e.preventDefault()
      const code = this.input?.value.trim()
      if (!code) return
      this.events?.onApply(code)
    })

    this.input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.applyBtn?.click()
      }
    })

    this.removeBtn?.addEventListener('click', (e) => {
      e.preventDefault()
      this.events?.onRemove()
    })
  }

  setEvents(events: CouponEvents): void {
    this.events = events
  }

  /**
   * Update the UI for the current state. Called after every calculate().
   * @param applied  Coupons currently applied (server-validated).
   * @param error    Error from the most recent attempt, if any.
   * @param pending  Code the user submitted that hasn't been validated yet (used to repopulate input on error).
   */
  render(applied: AppliedCouponResponse[], error: CouponErrorResponse | null): void {
    const isApplied = applied.length > 0
    const code = isApplied ? applied[0].code : null

    if (this.input) this.input.disabled = isApplied
    if (this.applyBtn) this.applyBtn.hidden = isApplied
    if (this.removeBtn) this.removeBtn.hidden = !isApplied

    if (this.appliedEl) this.appliedEl.hidden = !isApplied
    if (this.appliedCodeEl && code) this.appliedCodeEl.textContent = code

    if (this.errorEl) {
      if (error) {
        const message = this.labels.errors[error.errorCode] ?? this.labels.errorFallback
        this.errorEl.textContent = message
        this.errorEl.hidden = false
      } else {
        this.errorEl.textContent = ''
        this.errorEl.hidden = true
      }
    }

    // If applied, mirror the code into the input field so it's visible
    if (this.input && code) this.input.value = code
    if (this.input && !isApplied && !error) this.input.value = ''
  }

  setBusy(busy: boolean): void {
    if (this.applyBtn) this.applyBtn.disabled = busy
    if (this.removeBtn) this.removeBtn.disabled = busy
  }
}
