export function formatFileSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`
}

export function formatUnixSeconds(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString()
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toUpperCase()
}
