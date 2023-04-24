/** Marks a field invalid and points it at its message, or else at its hint when it has one. */
export const invalid = (id: string, error: string | undefined, hint?: string) => ({
  'aria-invalid': error !== undefined,
  'aria-describedby': error ? `${id}-error` : hint,
})
