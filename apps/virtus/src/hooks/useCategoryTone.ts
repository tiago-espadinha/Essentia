import { createContext, useContext } from 'react'
import { categoryTone } from '../domain/category'

/** The app provides tones for the categories in use; alone, a name keeps its preferred hue. */
export const CategoryToneContext = createContext<(category: string) => number>(categoryTone)

export const useCategoryTone = () => useContext(CategoryToneContext)
