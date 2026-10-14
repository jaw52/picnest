import type { StyleXStyles } from '@stylexjs/stylex'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import * as stylex from '@stylexjs/stylex'
import { useRef, useState } from 'react'
import { weight } from '~/theme/text'
import { styles, THUMB_SIZE, TRACK_INSET } from './style'

export interface SliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** The thumb's accessible name, also shown as the value label's prefix. */
  label?: string
  /** Formats the displayed value. */
  formatValue?: (value: number) => string
  /** Off, only the label shows, for a value whose number means nothing to the user. */
  showValue?: boolean
  disabled?: boolean
  xstyle?: StyleXStyles
}

interface Preview {
  left: number
  width: number
  rightward: boolean
}

/**
 * A value label and a thumb on a pill track. Base UI owns the pointer
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
  xstyle,
}: SliderProps) {
  const controlRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)

  const span = max - min || 1
  const fraction = (value - min) / span
  // The fill ends at the thumb center, measured from the pill's own left edge.
  const fillWidth = `calc(${THUMB_SIZE / 2 - TRACK_INSET}px + ${fraction} * (100% - ${THUMB_SIZE - 2 * TRACK_INSET}px))`

  const updatePreview = (clientX: number) => {
    const el = controlRef.current
    if (!el)
      return
    const rect = el.getBoundingClientRect()
    const usable = rect.width - THUMB_SIZE
    if (usable <= 0)
      return
    const x = Math.max(0, Math.min(usable, clientX - rect.left - THUMB_SIZE / 2))
    const raw = (x / usable) * span + min
    const snapped = Math.max(min, Math.min(max, Math.round((raw - min) / step) * step + min))
    const snappedX = THUMB_SIZE / 2 + ((snapped - min) / span) * usable
    const thumbX = THUMB_SIZE / 2 + fraction * usable
    // Extend to the track edges at the extremes so there's no gap.
    const edgeX = snapped === min ? 0 : snapped === max ? rect.width : snappedX
    setPreview({
      left: Math.min(thumbX, edgeX) - TRACK_INSET,
      width: Math.abs(edgeX - thumbX),
      rightward: edgeX > thumbX,
    })
  }

  const interacting = hovered || dragging
  const valueLabel = (v: number) => (showValue ? `${label ? `${label}: ` : ''}${formatValue(v)}` : label ?? '')
  const widest = valueLabel(max)

  return (
    <BaseSlider.Root
      value={value}
      onValueChange={next => onChange(next)}
      onValueCommitted={() => setDragging(false)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      thumbAlignment="edge"
      {...stylex.props(styles.root, xstyle)}
    >
      <span
        {...stylex.props(styles.value, interacting ? weight.semibold : weight.normal)}
      >
        {/* Invisible ghost reserves the width of the widest possible value. */}
        <span aria-hidden="true" {...stylex.props(styles.valueCell, styles.valueGhost)}>
          {widest}
        </span>
        <span {...stylex.props(styles.valueCell)}>{valueLabel(value)}</span>
      </span>
      <BaseSlider.Control
        ref={controlRef}
        onPointerDown={() => setDragging(true)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          setHovered(false)
          setPreview(null)
        }}
        onPointerMove={(e) => {
          if (!dragging)
            updatePreview(e.clientX)
        }}
        {...stylex.props(styles.control)}
      >
        <BaseSlider.Track {...stylex.props(styles.track)}>
          <div {...stylex.props(styles.fill, styles.fillWidth(fillWidth))} />
          <div
            {...stylex.props(
              styles.preview,
              preview && !dragging ? styles.previewVisible : styles.previewHidden,
              styles.previewPosition(preview?.left ?? 0, preview?.width ?? 0, preview?.rightward ?? true),
            )}
          />
        </BaseSlider.Track>
        {/* An explicit tabIndex: WebKit otherwise leaves the range input
         * out of the Tab order. */}
        <BaseSlider.Thumb aria-label={label} tabIndex={0} {...stylex.props(styles.thumb)}>
          <span {...stylex.props(styles.knob)} />
        </BaseSlider.Thumb>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}
