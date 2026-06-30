import { initNewsletterForm } from './newsletter-subscribe'

/**
 * Footer newsletter trigger → `<dialog>` modal.
 *
 * Uses the **non-modal** `dialog.show()` rather than `showModal()` on purpose:
 * `showModal()` puts the dialog in the browser top layer, which always paints
 * above normal DOM regardless of z-index — so hCaptcha's body-appended
 * challenge overlay would render *behind* the form. A non-modal dialog stacks
 * by z-index, letting the captcha challenge sit above it.
 *
 * Because it's non-modal we supply the modal trimmings ourselves: a backdrop
 * element, body scroll-lock, ESC-to-close, and focus restoration. The form is
 * initialised lazily on first open so hCaptcha loads only then.
 */
const SCROLL_LOCK_CLASS = 'newsletter-dialog-open'

export function initNewsletterDialog(): void {
  document.querySelectorAll<HTMLElement>('[data-newsletter-dialog]').forEach(setup)
}

function setup(wrapper: HTMLElement): void {
  const trigger = wrapper.querySelector<HTMLButtonElement>('[data-newsletter-open]')
  const dialog = wrapper.querySelector<HTMLDialogElement>('dialog')
  const backdrop = wrapper.querySelector<HTMLElement>('[data-newsletter-backdrop]')
  const form = wrapper.querySelector<HTMLElement>('[data-newsletter-subscribe]')
  if (!trigger || !dialog) return

  let initialised = false

  const open = (): void => {
    if (!initialised && form) {
      initNewsletterForm(form)
      initialised = true
    }
    dialog.show()
    if (backdrop) backdrop.hidden = false
    document.documentElement.classList.add(SCROLL_LOCK_CLASS)
    dialog.querySelector<HTMLElement>('input, [tabindex]')?.focus()
  }

  const close = (): void => {
    if (!dialog.open) return
    dialog.close()
    if (backdrop) backdrop.hidden = true
    document.documentElement.classList.remove(SCROLL_LOCK_CLASS)
    trigger.focus()
  }

  trigger.addEventListener('click', open)
  wrapper.querySelectorAll<HTMLElement>('[data-newsletter-close]').forEach((el) =>
    el.addEventListener('click', close),
  )
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dialog.open) {
      e.preventDefault()
      close()
    }
  })
}
