// Runs synchronously before paint — reads localStorage and sets data-theme on <html>
// to prevent flash of wrong theme.
;(function () {
  const theme = localStorage.getItem('theme')
  if (theme) document.documentElement.setAttribute('data-theme', theme)
})()
