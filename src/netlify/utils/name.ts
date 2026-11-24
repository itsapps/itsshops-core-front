/**
 * First/last name for systems that need them separately (WooCommerce-style export → Winenet,
 * which issues invoices from it).
 *
 * Orders only require the full `name`; `prename`/`lastname` exist only when the customer typed them
 * (manual checkout form). Express checkout (Apple/Google Pay) delivers just the full name, so the
 * split is a best guess made here, at export time, and never stored: last word → last name, the
 * rest → first name; a single word goes to the last name so it is never dropped.
 */
export function splitNameForExport(addr: {
  name?: string | null
  prename?: string | null
  lastname?: string | null
}): { firstName: string; lastName: string } {
  const prename = addr.prename?.trim()
  const lastname = addr.lastname?.trim()
  if (prename || lastname) return { firstName: prename ?? '', lastName: lastname ?? '' }

  const parts = (addr.name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: '', lastName: parts[0] }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}
