import type { Photo } from '../shared/types.ts'

/**
 * A tab's changed ratings, outside React state: a tile subscribes to its
 * own photo (useSyncExternalStore), so rating one photo re-renders that tile
 * alone rather than the grid. Subscribers to every rating (the rating
 * filter) see `version` change. A photo never rated here keeps its own.
 */
export class Ratings {
  private values = new Map<string, number>()
  private byId = new Map<string, Set<() => void>>()
  private any = new Set<() => void>()
  version = 0

  get = (photo: Photo) => this.values.get(photo.id) ?? photo.rating

  set(id: string, rating: number) {
    this.values.set(id, rating)
    this.version++
    this.byId.get(id)?.forEach(listener => listener())
    this.any.forEach(listener => listener())
  }

  subscribe(id: string, listener: () => void) {
    let listeners = this.byId.get(id)
    if (!listeners)
      this.byId.set(id, listeners = new Set())
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (!listeners.size)
        this.byId.delete(id)
    }
  }

  subscribeAll = (listener: () => void) => {
    this.any.add(listener)
    return () => this.any.delete(listener)
  }
}
