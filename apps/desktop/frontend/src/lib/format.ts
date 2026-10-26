import { i18n } from '~/i18n'
import type { PhotoGrouping } from '~/lib/photo'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
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
  return new Date(seconds * 1000).toLocaleString(i18n.language)
}

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot === -1 ? '' : fileName.slice(dot + 1).toUpperCase()
}

const PERIOD_FORMATS: Record<NonNullable<PhotoGrouping>, Intl.DateTimeFormatOptions> = {
  year: { year: 'numeric' },
  month: { year: 'numeric', month: 'long' },
  day: { year: 'numeric', month: 'long', day: 'numeric' },
}

/** Names the year, month or day starting at `start` (milliseconds since the epoch). */
export function formatPeriod(start: number, grouping: NonNullable<PhotoGrouping>): string {
  return new Date(start).toLocaleDateString(i18n.language, PERIOD_FORMATS[grouping])
}
