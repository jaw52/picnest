// Writes IMAGE_COUNT photo-like JPEGs (noise over gradients, so they decode
// like real photos rather than flat colors) as thumbnails and full-size
// images into public/img.

import { mkdirSync } from 'node:fs'
import sharp from 'sharp'
import { IMAGE_COUNT, imageAspectRatio, mulberry32 } from '../src/shared/data.ts'

const THUMB_EDGE = 480
const FULL_EDGE = 2400

function size(aspectRatio: number, edge: number) {
  return aspectRatio >= 1
    ? { width: edge, height: Math.round(edge / aspectRatio) }
    : { width: Math.round(edge * aspectRatio), height: edge }
}

function pixels(width: number, height: number, k: number) {
  const random = mulberry32(k + 1)
  const hue = [random() * 255, random() * 255, random() * 255]
  const data = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3
      const g = (x / width + y / height) / 2
      const n = (random() - 0.5) * 60
      data[o] = Math.min(255, Math.max(0, hue[0] * g + 40 + n))
      data[o + 1] = Math.min(255, Math.max(0, hue[1] * (1 - g) + 40 + n))
      data[o + 2] = Math.min(255, Math.max(0, hue[2] * g + 40 + n))
    }
  }
  return data
}

const out = new URL('../public/img/', import.meta.url).pathname
mkdirSync(`${out}t`, { recursive: true })
mkdirSync(`${out}f`, { recursive: true })

for (let k = 0; k < IMAGE_COUNT; k++) {
  const ratio = imageAspectRatio(k)
  const full = size(ratio, FULL_EDGE)
  const raw = sharp(pixels(full.width, full.height, k), { raw: { ...full, channels: 3 } })
  await raw.clone().jpeg({ quality: 85 }).toFile(`${out}f/${k}.jpg`)
  await raw.clone().resize(size(ratio, THUMB_EDGE)).jpeg({ quality: 80 }).toFile(`${out}t/${k}.jpg`)
  process.stdout.write('.')
}
console.log(`\n${IMAGE_COUNT} images in ${out}`)
