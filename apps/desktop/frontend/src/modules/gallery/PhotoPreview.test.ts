import type { Gallery } from '~/state/gallery'
import type { Photo } from '~/types/photo'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mountInTab } from '~/test/harness'
import MasonryView from './MasonryView.vue'
import PhotoPreview from './PhotoPreview.vue'

const { deletePhoto } = vi.hoisted(() => ({ deletePhoto: vi.fn() }))
vi.mock('~/composables/useDeletePhoto', () => ({ useDeletePhoto: () => deletePhoto }))
const { rate } = vi.hoisted(() => ({ rate: vi.fn() }))
vi.mock('~/composables/useRatePhoto', () => ({ useRatePhoto: () => rate }))
vi.mock('./MasonryPhotoItem.vue', () => ({ default: { render: () => null } }))
vi.mock('~/lib/native', () => ({
  convertFileSrc: (path: string) => path,
  convertLiveSrc: (path: string) => path,
  convertPreviewSrc: (path: string) => path,
  writeText: vi.fn(),
}))
vi.mock('~/lib/backend', () => ({ ensureThumbnailUrl: async () => new Promise(() => {}), THUMBNAIL_CANCELLED: {} }))
vi.mock('~/modules/tabs/FolderTile.vue', () => ({
  default: { props: ['name'], setup: (props: { name: string }) => () => h('span', props.name) },
}))

beforeEach(() => {
  deletePhoto.mockClear()
  rate.mockClear()
})

function photo(name: string): Photo {
  return {
    id: `/${name}.jpg`,
    path: `/${name}.jpg`,
    fileName: `${name}.jpg`,
    width: 100,
    height: 100,
    rating: 0,
    modified: 0,
    taken: 0,
    isCloudPlaceholder: false,
    aspectRatio: 1,
  }
}

/** The grid, with the lightbox over it unless left out, in a tab of its own. */
function mountGrid(prepare: (gallery: Gallery) => void, { preview = true, extra }: { preview?: boolean, extra?: () => ReturnType<typeof h> } = {}) {
  const Grid = defineComponent({
    setup: () => () => [h(MasonryView), preview ? h(PhotoPreview) : null, extra?.()],
  })
  return mountInTab(Grid, {}, prepare)
}

function keyDown(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
}

it.each(['Delete', 'Backspace'])(
  'routes %s only to the preview, then restores grid shortcuts on close',
  async (key) => {
    const [a, b] = [photo('a'), photo('b')]
    const { gallery } = mountGrid((g) => {
      g.currentFolder.value = '/'
      g.photos.value = [a, b]
      g.selectedPhotoIds.value = new Set([a.id, b.id])
      g.setPreviewPhotoId(b.id)
    })

    keyDown(key)
    expect(deletePhoto).toHaveBeenCalledTimes(1)
    expect(deletePhoto).toHaveBeenLastCalledWith([b])
    keyDown(key, { repeat: true })
    expect(deletePhoto).toHaveBeenCalledTimes(1)

    gallery.setPreviewPhotoId(null)
    await nextTick()
    keyDown(key)
    expect(deletePhoto).toHaveBeenCalledTimes(2)
    expect(deletePhoto).toHaveBeenLastCalledWith([a, b])
  },
)

it('rates the grid selection, then only the previewed photo, with the 0-5 keys', async () => {
  const [a, b] = [photo('a'), photo('b')]
  const { gallery } = mountGrid((g) => {
    g.currentFolder.value = '/'
    g.photos.value = [a, b]
    g.selectedPhotoIds.value = new Set([a.id, b.id])
  })

  keyDown('4')
  expect(rate.mock.calls).toEqual([[[a, b], 4]])

  rate.mockClear()
  keyDown('4', { metaKey: true })
  expect(rate).not.toHaveBeenCalled()

  gallery.setPreviewPhotoId(b.id)
  await nextTick()
  keyDown('5')
  expect(rate.mock.calls).toEqual([[[b], 5]])
})

it('stays blank until a folder loads, then notes an empty folder', async () => {
  const { gallery, wrapper } = mountGrid(() => {}, { preview: false })
  expect(wrapper.text()).toBe('')

  gallery.currentFolder.value = '/empty'
  await nextTick()
  expect(wrapper.text()).toContain('这个文件夹是空的')
})

it('lays out a folder that only holds other folders instead of calling it empty', () => {
  const { wrapper } = mountGrid((g) => {
    g.currentFolder.value = '/parent'
    g.subfolders.value = [{ name: '星云', path: '/parent/星云' }]
  }, { preview: false })
  expect(wrapper.find('[role="listbox"]').exists()).toBe(true)
  expect(wrapper.text()).not.toContain('这个文件夹是空的')
})

it('previews the selection on Space and closes the preview on Space, like Quick Look', async () => {
  const [a, b] = [photo('a'), photo('b')]
  const { gallery } = mountGrid((g) => {
    g.currentFolder.value = '/'
    g.photos.value = [a, b]
    g.selectedPhotoIds.value = new Set([b.id])
  })

  keyDown(' ')
  expect(gallery.previewPhotoId.value).toBe(b.id)

  await nextTick()
  keyDown(' ')
  expect(gallery.previewPhotoId.value).toBeNull()
})

it('leaves Space alone with nothing selected, on buttons, or with a modifier', () => {
  const [a, b] = [photo('a'), photo('b')]
  const { gallery, wrapper } = mountGrid((g) => {
    g.currentFolder.value = '/'
    g.photos.value = [a, b]
  }, { preview: false, extra: () => h('button', { type: 'button' }, 'star') })

  keyDown(' ')
  expect(gallery.previewPhotoId.value).toBeNull()

  gallery.selectedPhotoIds.value = new Set([a.id])
  keyDown(' ', {}, wrapper.get('button').element)
  expect(gallery.previewPhotoId.value).toBeNull()
  keyDown(' ', { metaKey: true })
  expect(gallery.previewPhotoId.value).toBeNull()
})

it('moves the selection with the arrow keys, extending it with Shift', () => {
  const [a, b, c] = [photo('a'), photo('b'), photo('c')]
  const { gallery } = mountGrid((g) => {
    g.currentFolder.value = '/'
    g.photos.value = [a, b, c]
  }, { preview: false })

  // Nothing selected yet: the first photo.
  keyDown('ArrowDown')
  expect(gallery.selectedPhotoIds.value).toEqual(new Set([a.id]))
  // One column here (the test DOM has no width), so down is the next photo.
  keyDown('ArrowDown')
  expect(gallery.selectedPhotoIds.value).toEqual(new Set([b.id]))
  keyDown('ArrowDown', { shiftKey: true })
  expect(gallery.selectedPhotoIds.value).toEqual(new Set([b.id, c.id]))
  keyDown('ArrowUp')
  expect(gallery.selectedPhotoIds.value).toEqual(new Set([b.id]))
})
