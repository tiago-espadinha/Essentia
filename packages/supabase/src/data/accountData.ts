/** Each synced app's keys; the first holds the `owner` of all of them. */
const ACCOUNT_KEYS = [
  ['essentia-virtus-sync', 'essentia-virtus-habits'],
  ['essentia-dictum-sync', 'essentia-dictum-documents', 'essentia-dictum-versions'],
  // Notes set aside with "Keep on this device only" (essentia-notes-device), the import ledger and a kept unreadable copy stay.
  ['essentia-notes-sync', 'essentia-notes', 'essentia-notes-versions', 'essentia-notes-folders'],
  ['essentia-aurum-sync', 'essentia-aurum-transactions', 'essentia-aurum-budgets', 'essentia-aurum-recurring'],
]

/** Acta keeps each account's copy under its own key; every key with this prefix belongs to an account. */
const ACTA_ACCOUNT_PREFIX = 'essentia-acta-account:'

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
  try {
    const owned = Object.keys(localStorage).filter((key) => key.startsWith(ACTA_ACCOUNT_PREFIX))
    for (const key of owned) localStorage.removeItem(key)
  } catch {
    // Storage is blocked: Acta still clears its own copy when it opens.
  }
}
