/** Register only built workers; development serves unbundled modules. */
export function registerOfflineWorker(base: string): void {
  if (!('serviceWorker' in navigator)) return
  const register = () => {
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' }).catch((error: unknown) => {
      console.error('Offline setup could not finish. Online use is still available.', error)
    })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
