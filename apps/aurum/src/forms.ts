/** Marks a field invalid and points it at its message. */
export const invalid = (id: string, error: string | undefined) => ({
  'aria-invalid': error !== undefined,
  'aria-describedby': error ? `${id}-error` : undefined,
})
