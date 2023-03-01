/** Each synced app's keys; the first holds the `owner` of all of them. */
const ACCOUNT_KEYS = [
  ['essentia-virtus-sync', 'essentia-virtus-habits'],
  ['essentia-dictum-sync', 'essentia-dictum-documents', 'essentia-dictum-versions'],
  ['essentia-aurum-sync', 'essentia-aurum-transactions', 'essentia-aurum-budgets', 'essentia-aurum-recurring'],
]

function ownerOf(key: string): string | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    const owner = typeof saved === 'object' && saved !== null && 'owner' in saved ? saved.owner : null
    return typeof owner === 'string' ? owner : null
  } catch {
    return null
  }
}

/**
 * Removes every app's copy that belongs to an account, opened or not, so the
 * next person on this device sees none of it. Data made while signed out stays.
 */
export function clearAccountData() {
  for (const keys of ACCOUNT_KEYS) {
    if (ownerOf(keys[0]) === null) continue
    try {
      for (const key of keys) localStorage.removeItem(key)
    } catch {
      // Storage is blocked: each app still clears its own copy when it opens.
    }
  }
}
