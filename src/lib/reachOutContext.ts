import { createContext, useContext } from 'react'

export const ReachOutContext = createContext<{ open: () => void }>({ open: () => undefined })

export function useReachOut() {
  return useContext(ReachOutContext)
}
