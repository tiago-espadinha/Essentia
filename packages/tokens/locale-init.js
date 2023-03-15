// Apply the language before rendering, including standalone and offline pages.
;(function () {
  function apply(value) {
    document.documentElement.lang = value === 'pt-PT' ? value : 'en-GB'
  }
  try {
    apply(localStorage.getItem('essentia-locale'))
  } catch {
    apply(null)
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== 'essentia-locale' && event.key !== null) return
    try {
      if (event.storageArea !== localStorage) return
    } catch {
      return
    }
    apply(event.newValue)
    window.dispatchEvent(new Event('essentia-locale-change'))
  })
})()
