import type { RecentFolder } from '~/types/folder'

import { describe, expect, it } from 'vitest'
import { folderNameFromPath, pathSegments, withFolderAdded, withFolderForgotten, withFolderRemoved } from './folders'

describe('folderNameFromPath', () => {
  it('returns the last path segment', () => {
    expect(folderNameFromPath('/Users/jaw/Photos/2026 Trip')).toBe('2026 Trip')
  })

  it('ignores a trailing slash', () => {
    expect(folderNameFromPath('/Users/jaw/Photos/')).toBe('Photos')
  })

  it('falls back to the whole string when there is no separator', () => {
    expect(folderNameFromPath('Photos')).toBe('Photos')
  })
})

describe('withFolderAdded', () => {
  const existing: RecentFolder[] = [
    { lastOpenedAt: 1, name: 'a', path: '/a' },
    { lastOpenedAt: 2, name: 'b', path: '/b' },
  ]

  it('appends a new root', () => {
    const result = withFolderAdded(existing, '/c')
    expect(result.map(f => f.path)).toEqual(['/a', '/b', '/c'])
  })

  it('keeps an already-known root in place', () => {
    const result = withFolderAdded(existing, '/b')
    expect(result.map(f => f.path)).toEqual(['/a', '/b'])
  })

  it('does not evict roots after adding 12 folders', () => {
    const many: RecentFolder[] = Array.from({ length: 12 }, (_, i) => ({
      lastOpenedAt: i,
      name: `f${i}`,
      path: `/f${i}`,
    }))
    const result = withFolderAdded(many, '/new')
    expect(result).toHaveLength(13)
    expect(result.at(-1)?.path).toBe('/new')
  })

  it('adds a folder inside an added one', () => {
    expect(withFolderAdded(existing, '/a/child').map(f => f.path)).toEqual(['/a', '/b', '/a/child'])
  })

  it('keeps the folders inside one that is added after them', () => {
    const children = [{ lastOpenedAt: 1, name: 'child', path: '/photos/child' }]
    expect(withFolderAdded(children, '/photos').map(f => f.path)).toEqual(['/photos/child', '/photos'])
  })

  it('does not confuse similarly named siblings with descendants', () => {
    expect(withFolderAdded(existing, '/abc').map(f => f.path)).toEqual(['/a', '/b', '/abc'])
  })
})

describe('withFolderRemoved', () => {
  it('removes the matching folder and keeps the rest', () => {
    const existing: RecentFolder[] = [
      { lastOpenedAt: 1, name: 'a', path: '/a' },
      { lastOpenedAt: 2, name: 'b', path: '/b' },
    ]
    expect(withFolderRemoved(existing, '/a').map(f => f.path)).toEqual(['/b'])
  })
})

describe('withFolderForgotten', () => {
  it('forgets only that folder, not the ones added inside it', () => {
    const existing: RecentFolder[] = [
      { lastOpenedAt: 1, name: 'a', path: '/a' },
      { lastOpenedAt: 2, name: 'child', path: '/a/child' },
    ]
    expect(withFolderForgotten(existing, '/a').map(f => f.path)).toEqual(['/a/child'])
  })
})

describe('pathSegments', () => {
  it('lists every folder from the added root down to the current one', () => {
    expect(pathSegments('/photos/2026/trip', ['/other', '/photos'])).toEqual([
      '/photos',
      '/photos/2026',
      '/photos/2026/trip',
    ])
  })

  it('treats a folder outside every added one as its own root', () => {
    expect(pathSegments('/loose/folder', ['/photos'])).toEqual(['/loose/folder'])
    expect(pathSegments('/photos', ['/photos'])).toEqual(['/photos'])
  })

  it('keeps Windows separators', () => {
    expect(pathSegments(String.raw`C:\pics\a`, [String.raw`C:\pics`])).toEqual([String.raw`C:\pics`, String.raw`C:\pics\a`])
  })
})
