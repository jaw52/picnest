/**
 * The folder pictures collected from the menu bar icon are saved in, inside
 * the app's data folder. It is read once, before the first render.
 */
let collectionPath = ''

export function setCollectionPath(path: string) {
  collectionPath = path
}

export function getCollectionPath(): string {
  return collectionPath
}

export function isCollectionPath(path: string | null): boolean {
  return collectionPath !== '' && path === collectionPath
}
