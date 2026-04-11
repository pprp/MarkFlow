import { vim } from '@replit/codemirror-vim'

/**
 * Vim keybinding mode extension: enables modal vim editing using
 * CodeMirror's vim extension with Normal, Insert, and Visual modes.
 */
export function vimModeExtension() {
  return vim()
}
