import type { AppliedDiscountResponse, CalculateResponse, CouponErrorResponse } from '../shared/checkout-api'
import { fill } from './checkout-changes'

export type CouponLabels = {
  apply: string
  remove: string
  applied: string
  /** By `errorCode`; `{title}` is filled with `discountTitle` (`COUPON_NOT_COMBINABLE`). */
  errors: Record<string, string>
  errorFallback: string
  /** "Nicht rabattiert: {items}" — the lines the applied code skipped. */
  notDiscounted?: string
}

export type CouponEvents = {
  /** Fired when the user submits a code. Caller should recalculate with that code. */
  onApply: (code: string) => void
  /** Fired when the user clicks remove. Caller should recalculate without a code. */
  onRemove: () => void
}

/**
 * Whether the stored code must be dropped after a response: the server rejected it and no code
 * discount is applied (automatic discounts don't count — with them the list is rarely empty).
 */
export function shouldClearStoredCode(response: Pick<CalculateResponse, 'couponError' | 'appliedDiscounts'>): boolean {
  return !!response.couponError && !response.appliedDiscounts.some(d => d.trigger === 'code')
}

export class CheckoutCoupon {
  private container: HTMLElement
  private input: HTMLInputElement | null
  private applyBtn: HTMLButtonElement | null
  private removeBtn: HTMLButtonElement | null
  private errorEl: HTMLElement | null
  private appliedEl: HTMLElement | null
  private appliedCodeEl: HTMLElement | null
  private hintEl: HTMLElement | null
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
    // A polite live region that is always in the DOM (announced reliably only then); empty = no hint.
    this.hintEl = container.querySelector<HTMLElement>('[data-checkout-coupon-hint]')
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
   * Update the UI for the current state. Called after every calculate() and submit.
   * @param applied  Applied discounts (server-validated). Only `trigger: 'code'` entries count —
   *                 an automatic discount must not lock the input or read "applied".
   * @param error    Error from the most recent attempt, if any.
   * @param notDiscounted  Titles of the cart lines the applied code skipped (the hint).
   */
  render(applied: AppliedDiscountResponse[], error: CouponErrorResponse | null, notDiscounted: string[] = []): void {
    const codeEntry = applied.find(d => d.trigger === 'code')
    const isApplied = !!codeEntry
    const code = codeEntry?.code ?? null

    if (this.input) this.input.disabled = isApplied
    if (this.applyBtn) this.applyBtn.hidden = isApplied
    if (this.removeBtn) this.removeBtn.hidden = !isApplied

    if (this.appliedEl) this.appliedEl.hidden = !isApplied
    if (this.appliedCodeEl && code) this.appliedCodeEl.textContent = code

    if (this.errorEl) {
      if (error) {
        const message = this.labels.errors[error.errorCode] ?? this.labels.errorFallback
        this.errorEl.textContent = fill(message, { title: error.discountTitle ?? '' })
        this.errorEl.hidden = false
      } else {
        this.errorEl.textContent = ''
        this.errorEl.hidden = true
      }
    }

    if (this.hintEl) {
      const show = isApplied && notDiscounted.length > 0 && !!this.labels.notDiscounted
      this.hintEl.textContent = show ? fill(this.labels.notDiscounted!, { items: notDiscounted.join(', ') }) : ''
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
