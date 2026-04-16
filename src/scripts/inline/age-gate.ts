// Runs synchronously before paint. Presence of this script alone means the
// age gate is enabled (the template only includes it when enabled). Sets
// data-age-gate-state="pending" on <html> so CSS can hide page content until
// the main script resolves the gate.
;(function () {
  try {
    if (localStorage.getItem('ageGate.confirmed') === '1') return
    document.documentElement.setAttribute('data-age-gate-state', 'pending')
  } catch (e) {
    // localStorage unavailable — show gate anyway
    document.documentElement.setAttribute('data-age-gate-state', 'pending')
  }
})()
