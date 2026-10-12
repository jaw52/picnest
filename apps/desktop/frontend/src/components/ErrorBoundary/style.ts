import * as stylex from '@stylexjs/stylex'
import { colors } from '~/theme/colors.stylex'

export const styles = stylex.create({
  root: {
    display: 'flex',
    height: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    textAlign: 'center',
  },
  title: { color: colors['--ps-destructive'] },
  muted: { color: colors['--ps-muted-foreground'] },
  message: { maxWidth: 448 },
})
