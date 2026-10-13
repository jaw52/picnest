import type { ReactElement, ReactNode } from 'react'
import type { IconComponent } from '~/lib/icon'
import { ContextMenu as BaseContextMenu } from '@base-ui/react/context-menu'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import * as stylex from '@stylexjs/stylex'
import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'
import { FluidHoverHighlight } from '~/components/FluidHoverHighlight'
import { useSize } from '~/context/size'
import { SurfaceProvider, useSurface } from '~/context/surface'
import { isOwnEvent, useFluidHover } from '~/hooks/use-fluid-hover'
import { surfaceStyles } from '~/theme/surface'
import { trim, weight } from '~/theme/text'
import { styles } from './style'

export interface ContextMenuItem {
  label: string
  icon?: IconComponent
  /** Tints the row red, for actions that remove files. */
  destructive?: boolean
  disabled?: boolean
  /** A key combination that does the same, shown at the row's end (e.g. ⌘W). */
  shortcut?: string
  onSelect: () => void
}

interface MenuHoverContextValue {
  registerItem: (index: number, element: HTMLElement | null) => void
  activeIndex: number | null
}

const MenuHoverContext = createContext<MenuHoverContextValue | null>(null)

interface MenuRowProps extends ContextMenuItem {
  index: number
}

function MenuRow({ index, label, icon: Icon, destructive, disabled, shortcut, onSelect }: MenuRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const hover = use(MenuHoverContext)
  const size = useSize()

  useEffect(() => {
    hover?.registerItem(index, ref.current)
    return () => hover?.registerItem(index, null)
  }, [hover, index])

  const lit = hover?.activeIndex === index
  const tone = destructive ? styles.destructive : lit ? styles.lit : styles.dim

  return (
    <BaseMenu.Item
      ref={ref}
      label={label}
      disabled={disabled}
      onClick={onSelect}
      data-fluid-hover-index={index}
      aria-label={label}
      // Fixed height so the text-box trim on the label doesn't shrink the row;
      // shrink-0 because the popup is a max-height flex column.
      {...stylex.props(styles.row, disabled && styles.rowDisabled, size.control, size.gap, size.itemPx)}
    >
      {Icon && <Icon size={size.icon} {...stylex.props(styles.icon, tone)} />}
      <span {...stylex.props(styles.label, size.text)}>
        <span
          aria-hidden="true"
          {...stylex.props(styles.labelSizer, weight.semibold, trim.capAlphabetic)}
        >
          {label}
        </span>
        <span
          {...stylex.props(styles.labelText, tone, trim.capAlphabetic, weight.normal)}
        >
          {label}
        </span>
      </span>
      {shortcut && (
        <span {...stylex.props(styles.shortcut, size.text, trim.capAlphabetic)}>{shortcut}</span>
      )}
    </BaseMenu.Item>
  )
}

interface MenuPopupProps {
  items: ContextMenuItem[]
}

function MenuPopup({ items }: MenuPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  const hover = useFluidHover(popupRef)
  const { activeIndex, setActiveIndex, handlers, registerItem } = hover
  // A menu stacks two steps above whatever it opens over, so it never melts
  // into a dialog or panel of the same color.
  const level = Math.min(useSurface() + 2, 8)

  const ctx = useMemo(() => ({ registerItem, activeIndex }), [registerItem, activeIndex])

  return (
    <SurfaceProvider value={level}>
      <MenuHoverContext value={ctx}>
        <BaseContextMenu.Popup
          ref={popupRef}
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          onClick={handlers.onClick}
          onFocus={(e) => {
            if (!isOwnEvent(e))
              return
            const indexAttr = (e.target as HTMLElement)
              .closest('[data-fluid-hover-index]')
              ?.getAttribute('data-fluid-hover-index')
            // Keyboard navigation moves the hover background only; in a menu
            // the highlighted row is the focus indicator.
            if (indexAttr != null)
              setActiveIndex(Number(indexAttr))
          }}
          onBlur={(e) => {
            if (!isOwnEvent(e))
              return
            if (e.currentTarget.contains(e.relatedTarget as Node))
              return
            setActiveIndex(null)
          }}
          {...stylex.props(styles.popup, ...surfaceStyles(level, 3))}
        >
          <FluidHoverHighlight hover={hover} />
          {items.map((item, index) => (
            <MenuRow key={item.label} index={index} {...item} />
          ))}
        </BaseContextMenu.Popup>
      </MenuHoverContext>
    </SurfaceProvider>
  )
}

export interface ContextMenuProps {
  items: ContextMenuItem[]
  /** The element that opens the menu on right-click. */
  children: ReactNode
  onOpenChange?: (open: boolean) => void
}

/** Right-click menu: Base UI's context menu with fluid-hover rows. */
export function ContextMenu({ items, children, onOpenChange }: ContextMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <BaseContextMenu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        onOpenChange?.(next)
      }}
    >
      <BaseContextMenu.Trigger {...stylex.props(styles.trigger)}>
        {children}
      </BaseContextMenu.Trigger>
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner sideOffset={2} {...stylex.props(styles.positioner)}>
          <MenuPopup items={items} />
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  )
}

export interface DropdownMenuProps {
  items: ContextMenuItem[]
  /** The button that opens the menu on click. */
  trigger: ReactElement
  onOpenChange?: (open: boolean) => void
}

/** Click-to-open menu, with the same rows as ContextMenu, anchored below its trigger. */
export function DropdownMenu({ items, trigger, onOpenChange }: DropdownMenuProps) {
  return (
    <BaseMenu.Root onOpenChange={open => onOpenChange?.(open)}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={4} align="start" {...stylex.props(styles.positioner)}>
          <MenuPopup items={items} />
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
