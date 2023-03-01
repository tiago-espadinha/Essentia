// Share links live under the app's own path: `/dictum/shared/<id>`.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The link a shared document is read at. */
export function shareUrl(linkId: string, base: string = import.meta.env.BASE_URL, origin: string = location.origin): string {
  return new URL(`${base}shared/${linkId}`, origin).href
}

/**
 * Whether the path is a share link, relative to the app's base path. The id is
 * null when it cannot be one (the page then says the link does not work), and
 * the result is null for any other page of the app.
 */
export function readSharePath(pathname: string, base: string = import.meta.env.BASE_URL): { id: string | null } | null {
  if (!pathname.startsWith(`${base}shared/`)) return null
  const id = pathname.slice(`${base}shared/`.length).replace(/\/$/, '')
  return { id: UUID.test(id) ? id.toLowerCase() : null }
}
