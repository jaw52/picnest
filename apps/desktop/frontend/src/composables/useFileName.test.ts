import type { Photo } from '~/types/photo'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useFileName } from './useFileName'

const { libraryFileNames } = vi.hoisted(() => ({ libraryFileNames: vi.fn() }))
vi.mock('~/lib/backend', () => ({ libraryFileNames }))

function photo(path: string, fileName = ''): Photo {
  return {
    id: path,
    path,
    fileName,
    width: 4,
    height: 3,
    rating: 0,
    modified: 0,
    taken: 0,
    isCloudPlaceholder: false,
    aspectRatio: 4 / 3,
  }
}

const Name = defineComponent({
  props: { photo: { type: Object as () => Photo, required: true } },
  setup(props) {
    const name = useFileName(() => props.photo)
    return () => h('span', { 'data-testid': props.photo.path }, name.value)
  },
})

const Names = defineComponent({
  props: { photos: { type: Array as () => Photo[], required: true } },
  setup: props => () => props.photos.map(p => h(Name, { key: p.path, photo: p })),
})

const text = (wrapper: ReturnType<typeof mount>, path: string) => wrapper.get(`[data-testid="${path}"]`).text()

beforeEach(() => {
  libraryFileNames.mockReset()
})

it('reads the names of the library photos shown together, once', async () => {
  libraryFileNames.mockImplementation(async (paths: string[]) =>
    Object.fromEntries(paths.map(p => [p, `${p.slice('photos:'.length)}.HEIC`])))
  const photos = [photo('photos:a'), photo('photos:b'), photo('/f/c.jpg', 'c.jpg')]
  const wrapper = mount(Names, { props: { photos } })

  expect(text(wrapper, '/f/c.jpg')).toBe('c.jpg')
  await vi.waitFor(() => expect(text(wrapper, 'photos:b')).toBe('b.HEIC'))
  expect(text(wrapper, 'photos:a')).toBe('a.HEIC')
  expect(libraryFileNames).toHaveBeenCalledTimes(1)
  expect(libraryFileNames).toHaveBeenCalledWith(['photos:a', 'photos:b'])

  // Shown again, they come from what was read.
  await wrapper.setProps({ photos: photos.slice(0, 1) })
  expect(text(wrapper, 'photos:a')).toBe('a.HEIC')
  expect(libraryFileNames).toHaveBeenCalledTimes(1)
})

it('asks again for names it failed to read', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  libraryFileNames.mockRejectedValueOnce('no access').mockResolvedValueOnce({ 'photos:z': 'z.JPG' })
  const first = mount(Name, { props: { photo: photo('photos:z') } })
  await vi.waitFor(() => expect(libraryFileNames).toHaveBeenCalledTimes(1))
  await flushPromises()
  first.unmount()

  const second = mount(Name, { props: { photo: photo('photos:z') } })
  await vi.waitFor(() => expect(second.get('[data-testid="photos:z"]').text()).toBe('z.JPG'))
  expect(libraryFileNames).toHaveBeenCalledTimes(2)
})
