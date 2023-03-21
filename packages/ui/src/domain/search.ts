/** Opening search must not commit an editor's save-on-blur metadata draft. */
export function isSearchFocus(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('.ui-search, .ui-search-trigger') !== null
}
