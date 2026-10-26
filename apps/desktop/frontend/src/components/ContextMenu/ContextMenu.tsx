import { ContextMenu as BaseContextMenu } from '@base-ui/react/context-menu'
import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ReactElement, ReactNode } from 'react'
import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'

import { FluidHoverHighlight } from '~/components/FluidHoverHighlight'
import { isOwnEvent, useFluidHover } from '~/hooks/use-fluid-hover'
import { cn } from '~/lib/cn'
import type { IconComponent } from '~/lib/icon'
import { popupSurface } from '~/lib/surface'

export interface ContextMenuItem {
  /** Tints the row red, for actions that remove files. */
  destructive?: boolean
  disabled?: boolean
  icon?: IconComponent
  /** Tells rows apart when labels can repeat, as two folders' names can. */
  id?: string
  label: string
  onSelect: () => void
  /** A key combination that does the same, shown at the row's end (e.g. ⌘W). */
  shortcut?: string
}

interface MenuHoverContextValue {
  activeIndex: number | null
  registerItem: (index: number, element: HTMLElement | null) => void
}

const MenuHoverContext = createContext<MenuHoverContextValue | null>(null)

interface MenuRowProps extends ContextMenuItem {
  index: number
}

function MenuRow({ index, label, icon: Icon, destructive, disabled, shortcut, onSelect }: MenuRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const hover = use(MenuHoverContext)

  useEffect(() => {
    hover?.registerItem(index, ref.current)
    return () => hover?.registerItem(index, null)
  }, [hover, index])

  const lit = hover?.activeIndex === index
  const tone = destructive ? 'text-red' : lit ? 'text-text' : 'text-text-secondary'

  return (
    <BaseMenu.Item
      data-fluid-hover-index={index}
      disabled={disabled}
      label={label}
      ref={ref}
      className={cn(
        'relative z-10 flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-item px-1.5 outline-none',
        disabled && 'pointer-events-none opacity-50',
      )}
      aria-label={label}
      // Fixed height so the text-box trim on the label doesn't shrink the row;
      // shrink-0 because the popup is a max-height flex column.
      onClick={onSelect}
    >
      {/* The tone goes on a wrapper: an icon's own inline color is currentColor. */}
      {Icon && (
        <span className={cn('flex shrink-0 transition-colors duration-80', tone)}>
          <Icon height={14} width={14} />
        </span>
      )}
      <span className="inline-grid grow text-body">
        <span aria-hidden="true" className="wght-semibold text-trim invisible col-start-1 row-start-1">
          {label}
        </span>
        <span
          className={cn(
            'wght-normal text-trim col-start-1 row-start-1 transition-[color,font-variation-settings] duration-80',
            tone,
          )}
        >
          {label}
        </span>
      </span>
      {shortcut && <span className="text-trim shrink-0 text-body text-text-secondary">{shortcut}</span>}
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
  const ctx = useMemo(() => ({ registerItem, activeIndex }), [registerItem, activeIndex])

  return (
    <MenuHoverContext value={ctx}>
      <BaseContextMenu.Popup
        ref={popupRef}
        className={cn(
          popupSurface,
          'relative box-border flex max-h-[min(480px,var(--available-height))] w-56 max-w-full origin-(--transform-origin) flex-col gap-0.5 overflow-y-auto rounded-container p-1 outline-none select-none',
          'transition-[opacity,transform] duration-80 ease-out data-ending-style:scale-y-96 data-ending-style:opacity-0 data-starting-style:scale-y-96 data-starting-style:opacity-0',
        )}
        onClick={handlers.onClick}
        onMouseLeave={handlers.onMouseLeave}
        onMouseMove={handlers.onMouseMove}
        onBlur={(e) => {
          if (!isOwnEvent(e)) return
          if (e.currentTarget.contains(e.relatedTarget)) return
          setActiveIndex(null)
        }}
        // The popup is the rows' offsetParent, so the hover highlight measures from
        // its padding corner. Rows are as tall as their hover highlight: keep
        // neighbours apart.
        onFocus={(e) => {
          if (!isOwnEvent(e)) return
          const indexAttr = (e.target as HTMLElement).closest<HTMLElement>('[data-fluid-hover-index]')?.dataset
            .fluidHoverIndex
          // Keyboard navigation moves the hover background only; in a menu
          // the highlighted row is the focus indicator.
          if (indexAttr != null) setActiveIndex(Number(indexAttr))
        }}
      >
        <FluidHoverHighlight hover={hover} />
        {items.map((item, index) => (
          <MenuRow index={index} key={item.id ?? item.label} {...item} />
        ))}
      </BaseContextMenu.Popup>
    </MenuHoverContext>
  )
}

export interface ContextMenuProps {
  /** The element that opens the menu on right-click. */
  children: ReactNode
  items: ContextMenuItem[]
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
      <BaseContextMenu.Trigger className="contents">{children}</BaseContextMenu.Trigger>
      <BaseContextMenu.Portal>
        <BaseContextMenu.Positioner className="z-50" sideOffset={2}>
          <MenuPopup items={items} />
        </BaseContextMenu.Positioner>
      </BaseContextMenu.Portal>
    </BaseContextMenu.Root>
  )
}

export interface DropdownMenuProps {
  items: ContextMenuItem[]
  onOpenChange?: (open: boolean) => void
  /** The button that opens the menu on click. */
  trigger: ReactElement
}

/** Click-to-open menu, with the same rows as ContextMenu, anchored below its trigger. */
export function DropdownMenu({ items, trigger, onOpenChange }: DropdownMenuProps) {
  return (
    <BaseMenu.Root onOpenChange={(open) => onOpenChange?.(open)}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner align="start" className="z-50" sideOffset={4}>
          <MenuPopup items={items} />
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}
