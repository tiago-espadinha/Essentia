import { useCategoryTone } from '../hooks/useCategoryTone'

/** A small dot in the category's colour; decorative, so always beside the category name. */
export function CategoryMarker({ category }: { category: string }) {
  const tone = useCategoryTone()
  return <span className="category-marker" data-category-tone={tone(category)} aria-hidden="true" />
}
