import { useCallback, useState } from 'react'

export function useSearchDialogs() {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false)
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false)

  const closeSearchDialogs = useCallback(() => {
    setIsQuickOpenOpen(false)
    setIsGlobalSearchOpen(false)
    setIsGoToLineOpen(false)
  }, [])

  const openCommandPalette = useCallback(() => {
    closeSearchDialogs()
    setIsCommandPaletteOpen(true)
  }, [closeSearchDialogs])

  const closeCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(false)
  }, [])

  const openQuickOpen = useCallback(() => {
    setIsCommandPaletteOpen(false)
    setIsGlobalSearchOpen(false)
    setIsGoToLineOpen(false)
    setIsQuickOpenOpen(true)
  }, [])

  const closeQuickOpen = useCallback(() => {
    setIsQuickOpenOpen(false)
  }, [])

  const openGlobalSearch = useCallback(() => {
    setIsCommandPaletteOpen(false)
    setIsQuickOpenOpen(false)
    setIsGoToLineOpen(false)
    setIsGlobalSearchOpen(true)
    return true
  }, [])

  const toggleGlobalSearch = useCallback(() => {
    setIsCommandPaletteOpen(false)
    setIsQuickOpenOpen(false)
    setIsGoToLineOpen(false)
    setIsGlobalSearchOpen((current) => !current)
    return true
  }, [])

  const closeGlobalSearch = useCallback(() => {
    setIsGlobalSearchOpen(false)
  }, [])

  const openGoToLine = useCallback(() => {
    setIsCommandPaletteOpen(false)
    setIsQuickOpenOpen(false)
    setIsGlobalSearchOpen(false)
    setIsGoToLineOpen(true)
    return true
  }, [])

  const closeGoToLine = useCallback(() => {
    setIsGoToLineOpen(false)
  }, [])

  return {
    isCommandPaletteOpen,
    isQuickOpenOpen,
    isGlobalSearchOpen,
    isGoToLineOpen,
    openCommandPalette,
    closeCommandPalette,
    openQuickOpen,
    closeQuickOpen,
    openGlobalSearch,
    toggleGlobalSearch,
    closeGlobalSearch,
    openGoToLine,
    closeGoToLine,
  }
}
