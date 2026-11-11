// Runs synchronously before paint — reads localStorage and sets data-theme on <html>
// to prevent flash of wrong theme. localStorage can throw (blocked site data, some private
// modes); the page then simply follows the system theme.
;(function () {
  try {
    const theme = localStorage.getItem('theme')
    if (theme) document.documentElement.setAttribute('data-theme', theme)
  } catch {
    /* no storage: system theme */
  }
})()
