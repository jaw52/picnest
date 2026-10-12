import { createContext } from 'react'

export type SizeVariant = 'default' | 'compact'

export const SizeContext = createContext<SizeVariant>('default')
