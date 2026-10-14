import { describe, expect, it } from 'vitest'
import { resources } from '.'

const PLURAL = /_(?:zero|one|two|few|many|other)$/

/** Every key path and the interpolations of its text, plural forms merged. */
function shape(catalog: object, prefix = ''): Map<string, string[]> {
  const keys = new Map<string, string[]>()
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix + key.replace(PLURAL, '')
    if (typeof value === 'object') {
      for (const [k, v] of shape(value, `${path}.`))
        keys.set(k, v)
    }
    else {
      const names = [...String(value).matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
      keys.set(path, [...new Set([...(keys.get(path) ?? []), ...names])].sort())
    }
  }
  return keys
}

describe('catalogs', () => {
  const reference = shape(resources['zh-CN'].translation)

  it.each(Object.keys(resources))('%s has the same keys and interpolations as zh-CN', (language) => {
    const catalog = shape(resources[language as keyof typeof resources].translation)
    expect(Object.fromEntries(catalog)).toEqual(Object.fromEntries(reference))
  })
})
