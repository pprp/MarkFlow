import type { MarkFlowDesktopAPI } from '@markflow/shared'

declare global {
  interface Window {
    markflow?: MarkFlowDesktopAPI
  }
}

export {}
