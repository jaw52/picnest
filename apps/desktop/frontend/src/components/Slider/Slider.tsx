import { Slider as BaseSlider } from '@base-ui/react/slider'
import { useRef, useState } from 'react'

import { cn } from '~/lib/cn'

/**
 * The thumb's layout box. Travel is the track width minus this, so the thumb
 * never overhangs either end; the visible knob is the smaller circle inside it.
 */
const THUMB_SIZE = 20

export interface SliderProps {
  className?: string
  disabled?: boolean
  /** Formats the displayed value. */
  formatValue?: (value: number) => string
  /** The thumb's accessible name, also shown as the value label's prefix. */
  label?: string
  max?: number
  min?: number
  onChange: (value: number) => void
  /** Off, no text shows, for a value whose number means nothing to the user; the label stays as the thumb's accessible name. */
  showValue?: boolean
  step?: number
  value: number
}

interface Preview {
  left: number
  rightward: boolean
  width: number
}

/**
 * A value label and a thumb on a thin rail. Base UI owns the pointer
 * handling, ARIA and arrow keys; hovering previews a click with a bar from the
 * thumb to the step under the cursor.
 */
export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  formatValue = String,
  showValue = true,
  disabled = false,
  className,
}: SliderProps) {
  const controlRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)

  const span = max - min || 1
  const fraction = (value - min) / span
  // The fill ends at the thumb center.
  const fillWidth = `calc(${THUMB_SIZE / 2}px + ${fraction} * (100% - ${THUMB_SIZE}px))`

  const updatePreview = (clientX: number) => {
    const el = controlRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const usable = rect.width - THUMB_SIZE
    if (usable <= 0) return
    const x = Math.max(0, Math.min(usable, clientX - rect.left - THUMB_SIZE / 2))
    const raw = (x / usable) * span + min
    const snapped = Math.max(min, Math.min(max, Math.round((raw - min) / step) * step + min))
    const snappedX = THUMB_SIZE / 2 + ((snapped - min) / span) * usable
    const thumbX = THUMB_SIZE / 2 + fraction * usable
    // Extend to the track edges at the extremes so there's no gap.
    const edgeX = snapped === min ? 0 : snapped === max ? rect.width : snappedX
    setPreview({
      left: Math.min(thumbX, edgeX),
      width: Math.abs(edgeX - thumbX),
      rightward: edgeX > thumbX,
    })
  }

  const interacting = hovered || dragging
  const valueLabel = (v: number) => `${label ? `${label}: ` : ''}${formatValue(v)}`
  const widest = valueLabel(max)

  return (
    <BaseSlider.Root
      disabled={disabled}
      max={max}
      min={min}
      step={step}
      thumbAlignment="edge"
      value={value}
      className={cn(
        'flex w-full touch-none items-center gap-2 overflow-visible select-none data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      onValueChange={(next) => onChange(next)}
      onValueCommitted={() => setDragging(false)}
    >
      {showValue && (
        // Weight, not color, signals interaction: normal -> semibold while hovered
        // or pressed. tabular-nums plus a ghost set at semibold (the heaviest this
        // label gets) keep the box from changing width.
        <span
          className={cn(
            'inline-grid shrink-0 text-body leading-none text-text-secondary tabular-nums transition-[font-variation-settings] duration-100',
            interacting ? 'wght-semibold' : 'wght-normal',
          )}
        >
          {/* Invisible ghost reserves the width of the widest possible value. */}
          <span aria-hidden="true" className="wght-semibold col-start-1 row-start-1 invisible whitespace-nowrap">
            {widest}
          </span>
          <span className="col-start-1 row-start-1 whitespace-nowrap">{valueLabel(value)}</span>
        </span>
      )}
      <BaseSlider.Control
        className="relative h-9 min-w-0 flex-1 basis-0 cursor-ew-resize"
        ref={controlRef}
        onPointerDown={() => setDragging(true)}
        onPointerEnter={() => setHovered(true)}
        onPointerMove={(e) => {
          if (!dragging) updatePreview(e.clientX)
        }}
        // py-2 adds 8px above and below the 20px thumb row, so the press target is
        // 36px tall.
        onPointerLeave={() => {
          setHovered(false)
          setPreview(null)
        }}
      >
        {/* The unfilled rail is hatched with fine diagonal stripes. overflow hidden
         * clips the fill and hover bar to it, so they inherit its rounded ends. */}
        <BaseSlider.Track className="absolute inset-x-0 top-[15px] h-1.5 overflow-hidden rounded-full bg-text/10 bg-[repeating-linear-gradient(-45deg,color-mix(in_srgb,var(--color-text)_8%,transparent)_0_1px,transparent_1px_3px)]">
          <div className="absolute top-0 left-0 h-full bg-text/30" style={{ width: fillWidth }} />
          {/* The bar previews what a click would change: it runs from the thumb's
           * center to the snapped hover value, fading over 150ms. */}
          <div
            className={cn(
              'pointer-events-none absolute top-0 z-2 h-full bg-text/20 transition-opacity duration-150',
              preview && !dragging ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              left: preview?.left ?? 0,
              width: preview?.width ?? 0,
              borderRadius: (preview?.rightward ?? true) ? '0 9999px 9999px 0' : '9999px 0 0 9999px',
            }}
          />
        </BaseSlider.Track>
        {/* An explicit tabIndex: WebKit otherwise leaves the range input
         * out of the Tab order. */}
        {/* A 20px box centered on the track holding the 18px knob. The ring is
         * drawn around the box, 2px out (24px), for keyboard focus only. */}
        <BaseSlider.Thumb
          aria-label={label}
          className="z-10 flex size-5 items-center justify-center rounded-full outline-offset-1 outline-none has-focus-visible:outline-1 has-focus-visible:outline-accent"
          tabIndex={0}
        >
          <span className="size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-[width,height] duration-80" />
        </BaseSlider.Thumb>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
