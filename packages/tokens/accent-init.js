// A blocking head script applies the saved palette before styles can paint.
// Public symlinks keep this startup behavior identical in every app.
;(function () {
  function applyAccent(value) {
    document.documentElement.dataset.accent =
      value === 'blue' || value === 'violet' ? value : 'terracotta'
  }

  try {
    applyAccent(localStorage.getItem('essentia-accent'))
  } catch {
    applyAccent(null)
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== 'essentia-accent' && event.key !== null) return
    try {
      if (event.storageArea !== localStorage) return
    } catch {
      return
    }
    applyAccent(event.newValue)
    window.dispatchEvent(new Event('essentia-accent-change'))
  })
})()
