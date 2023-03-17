// This recovery page has no application state or account client.
function applyPreferences() {
  try {
    for (const key of ['theme', 'accent']) {
      const value = localStorage.getItem(`essentia-${key}`)
      const choices = key === 'theme' ? ['light', 'dark'] : ['terracotta', 'blue', 'violet']
      if (choices.includes(value)) document.documentElement.dataset[key] = value
      else delete document.documentElement.dataset[key]
    }
    document.documentElement.lang = localStorage.getItem('essentia-locale') === 'pt-PT' ? 'pt-PT' : 'en-GB'
  } catch {
    // With blocked storage, the system theme and English remain usable.
  }
  const portuguese = document.documentElement.lang === 'pt-PT'
  document.querySelector('h1').textContent = portuguese ? 'É necessária uma ligação.' : 'A connection is needed.'
  document.querySelector('main p').textContent = portuguese
    ? 'Esta página precisa de uma ligação. Volte a ligar-se e tente novamente.'
    : 'This page needs a connection. Reconnect and try again.'
  document.querySelector('button').textContent = portuguese ? 'Tentar novamente' : 'Try again'
  document.querySelector('main a').textContent = portuguese ? 'Voltar à Essentia' : 'Back to Essentia'
}

applyPreferences()
window.addEventListener('storage', applyPreferences)
document.querySelector('button').addEventListener('click', () => location.reload())
