import { describe, expect, it, vi } from 'vitest'
import { scanFolderPage } from '~/lib/backend'
import { photoGrouping } from '~/state/gallery'
import { recentFolders } from '~/state/recentFolders'
import { setupInTab } from '~/test/harness'
import { useOpenFolder } from './useOpenFolder'

vi.mock('~/lib/backend', () => ({
  scanFolderPage: vi.fn().mockResolvedValue({ photos: [], total: 0 }),
  watchFolder: vi.fn().mockResolvedValue(undefined),
  listSubfolders: vi.fn().mockResolvedValue([]),
}))

describe('useOpenFolder', () => {
  it('navigateToFolder loads the folder without bookmarking it', async () => {
    const { result, gallery } = setupInTab(() => useOpenFolder())

    await result.navigateToFolder('/a/b/nested')

    expect(gallery.currentFolder.value).toBe('/a/b/nested')
    expect(recentFolders.value).toEqual([])
  })

  it('loads every page of a folder once', async () => {
    const files = mockFolder(700)
    const { result, gallery } = setupInTab(() => useOpenFolder())

    await result.navigateToFolder('/f')

    expect(gallery.photos.value.map(p => p.path)).toEqual(files.map(f => f.path))
  })

  it('holds back the later pages while grouped, until the scan is done', async () => {
    const files = mockFolder(700)
    photoGrouping.value = 'month'
    const { result, gallery } = setupInTab(() => useOpenFolder())
    const shown: number[] = []
    const scan = vi.mocked(scanFolderPage).getMockImplementation()!
    vi.mocked(scanFolderPage).mockImplementation(async (...args) => {
      shown.push(gallery.photos.value.length)
      return scan(...args)
    })

    await result.navigateToFolder('/f')

    // Fetching the first page, the second, then the third.
    expect(shown).toEqual([0, 300, 300])
    expect(gallery.photos.value.map(p => p.path)).toEqual(files.map(f => f.path))
    photoGrouping.value = null
  })
})

/** Has scanFolderPage serve a folder of `count` photos, and returns them. */
function mockFolder(count: number) {
  const meta = (path: string) => ({
    path,
    fileName: path,
    width: 1,
    height: 1,
    rating: 0,
    modified: 0,
    taken: 0,
    isCloudPlaceholder: false,
  })
  const files = Array.from({ length: count }, (_, i) => meta(`/f/${i}.jpg`))
  vi.mocked(scanFolderPage).mockImplementation(async (_folder, offset, limit) => (
    { photos: files.slice(offset, offset + limit), total: files.length }
  ))
  return files
}
