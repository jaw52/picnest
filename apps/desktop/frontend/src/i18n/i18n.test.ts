import { describe, expect, it } from 'vitest'
import { messages } from '.'

/** Every key path and the interpolations of its text, plural forms merged. */
function shape(catalog: object, prefix = ''): Map<string, string[]> {
  const keys = new Map<string, string[]>()
  for (const [key, value] of Object.entries(catalog as Record<string, unknown>)) {
    const path = prefix + key
    if (typeof value === 'object' && value !== null) {
      for (const [k, v] of shape(value, `${path}.`))
        keys.set(k, v)
    }
    else {
      const names = [...String(value).matchAll(/\{(\w+)\}/g)].map(m => m[1])
      keys.set(path, [...new Set(names)].toSorted((a, b) => a.localeCompare(b)))
    }
  }
  return keys
}

describe('catalogs', () => {
  const reference = shape(messages['zh-CN'])

  it.each(Object.keys(messages))('%s has the same keys and interpolations as zh-CN', (language) => {
    const catalog = shape(messages[language as keyof typeof messages])
    expect(Object.fromEntries(catalog)).toEqual(Object.fromEntries(reference))
  })
})
