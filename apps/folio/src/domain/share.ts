// A shared note is read at `/folio/shared/<id>`. Links made by Dictum,
// `/dictum/shared/<id>`, open the same view. Both paths are fixed by the
// rewrites in vercel.json, whatever path the app is built for.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SHARE_PATHS = ['/folio/shared/', '/dictum/shared/']

/** The link a shared note is read at. */
export function shareUrl(linkId: string, origin: string = location.origin): string {
  return new URL(`${SHARE_PATHS[0]}${linkId}`, origin).href
}

/**
 * Whether the path is a share link. The id is null when it cannot be one (the
 * page then says the link does not work), and the result is null for any other page.
 */
export function readSharePath(pathname: string, prefixes: string[] = SHARE_PATHS): { id: string | null } | null {
  const prefix = prefixes.find((start) => pathname.startsWith(start))
  if (!prefix) return null
  const id = pathname.slice(prefix.length).replace(/\/$/, '')
  return { id: UUID.test(id) ? id.toLowerCase() : null }
}
