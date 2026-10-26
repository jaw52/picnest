/** The cell every card on the new-tab page sits in: an icon over its name. `group/card` lets the icon well react to the card's hover. */
export const cardClass = 'group/card flex cursor-pointer flex-col items-center gap-1.5 bg-transparent p-1 text-text'

/** Like Finder, hovering highlights the icon, not the whole cell. */
export const cardIconWellClass = 'rounded-item p-2 transition-colors duration-80 group-hover/card:bg-text/5'
