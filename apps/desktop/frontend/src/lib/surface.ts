/** Translucent blurred shell shared by popovers, menus, tooltips-on-surface and dialogs. */
export const popupSurface = 'bg-material-thick ring-1 ring-border backdrop-blur-xl shadow-lg'

/** Dimming backdrop of a modal dialog. */
export const dialogBackdrop =
  'fixed inset-0 z-60 bg-black/40 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0'

/**
 * The shell shared by modal dialogs: a centred popup that fades and settles in.
 * Each dialog adds its own size and layout.
 */
export const dialogPopup =
  'fixed top-1/2 left-1/2 z-60 box-border flex -translate-x-1/2 -translate-y-1/2 flex-col rounded-container bg-material-ultra-thick shadow-2xl ring-1 ring-border outline-none backdrop-blur-xl transition-[opacity,transform] duration-150 ease-out-expo data-ending-style:scale-97 data-ending-style:opacity-0 data-starting-style:scale-97 data-starting-style:opacity-0'
