import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The six type roles in app.css are font sizes, not text colors.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'title', 'subtitle', 'body', 'caption', 'micro'] }],
      'font-weight': [{ wght: ['normal', 'semibold', 'bold'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
