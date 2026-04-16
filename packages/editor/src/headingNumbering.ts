export const HEADING_NUMBERING_STORAGE_KEY = 'markflow.heading-numbering.v1'
export const HEADING_NUMBERING_ATTRIBUTE = 'data-mf-heading-numbering'
export const HEADING_NUMBERING_STYLE_ELEMENT_ID = 'mf-heading-numbering-style'
export const HEADING_NUMBERING_OUTLINE_LEVEL_ATTRIBUTE = 'data-mf-outline-level'

type PersistedHeadingNumberingState = {
  enabled: boolean
}

type LooseStorage = Storage & Record<string, unknown>
const fallbackStorage = new Map<string, string>()

export const HEADING_NUMBERING_CSS = `
[data-mf-heading-numbering="true"] .cm-content {
  counter-reset: mf-editor-h1;
}

[data-mf-heading-numbering="true"] .cm-content .mf-h1 {
  counter-reset: mf-editor-h2 mf-editor-h3 mf-editor-h4 mf-editor-h5 mf-editor-h6;
}

[data-mf-heading-numbering="true"] .cm-content .mf-h2 {
  counter-reset: mf-editor-h3 mf-editor-h4 mf-editor-h5 mf-editor-h6;
}

[data-mf-heading-numbering="true"] .cm-content .mf-h3 {
  counter-reset: mf-editor-h4 mf-editor-h5 mf-editor-h6;
}

[data-mf-heading-numbering="true"] .cm-content .mf-h4 {
  counter-reset: mf-editor-h5 mf-editor-h6;
}

[data-mf-heading-numbering="true"] .cm-content .mf-h5 {
  counter-reset: mf-editor-h6;
}

[data-mf-heading-numbering="true"] .cm-content .mf-h1::before,
[data-mf-heading-numbering="true"] .cm-content .mf-h2::before,
[data-mf-heading-numbering="true"] .cm-content .mf-h3::before,
[data-mf-heading-numbering="true"] .cm-content .mf-h4::before,
[data-mf-heading-numbering="true"] .cm-content .mf-h5::before,
[data-mf-heading-numbering="true"] .cm-content .mf-h6::before,
[data-mf-heading-numbering="true"] .mf-outline-item .mf-outline-item-text::before {
  color: var(--mf-fg-muted);
  font-family: var(--mf-font-sans);
  font-size: 0.72em;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  margin-right: 0.5em;
}

[data-mf-heading-numbering="true"] .cm-content .mf-h1::before {
  counter-increment: mf-editor-h1;
  content: counter(mf-editor-h1) ". ";
}

[data-mf-heading-numbering="true"] .cm-content .mf-h2::before {
  counter-increment: mf-editor-h2;
  content: counter(mf-editor-h1) "." counter(mf-editor-h2) ". ";
}

[data-mf-heading-numbering="true"] .cm-content .mf-h3::before {
  counter-increment: mf-editor-h3;
  content: counter(mf-editor-h1) "." counter(mf-editor-h2) "." counter(mf-editor-h3) ". ";
}

[data-mf-heading-numbering="true"] .cm-content .mf-h4::before {
  counter-increment: mf-editor-h4;
  content: counter(mf-editor-h1) "." counter(mf-editor-h2) "." counter(mf-editor-h3) "." counter(mf-editor-h4) ". ";
}

[data-mf-heading-numbering="true"] .cm-content .mf-h5::before {
  counter-increment: mf-editor-h5;
  content: counter(mf-editor-h1) "." counter(mf-editor-h2) "." counter(mf-editor-h3) "." counter(mf-editor-h4) "." counter(mf-editor-h5) ". ";
}

[data-mf-heading-numbering="true"] .cm-content .mf-h6::before {
  counter-increment: mf-editor-h6;
  content: counter(mf-editor-h1) "." counter(mf-editor-h2) "." counter(mf-editor-h3) "." counter(mf-editor-h4) "." counter(mf-editor-h5) "." counter(mf-editor-h6) ". ";
}

[data-mf-heading-numbering="true"] .mf-outline-nav {
  counter-reset: mf-outline-h1;
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="1"] {
  counter-increment: mf-outline-h1;
  counter-reset: mf-outline-h2 mf-outline-h3 mf-outline-h4 mf-outline-h5 mf-outline-h6;
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="2"] {
  counter-increment: mf-outline-h2;
  counter-reset: mf-outline-h3 mf-outline-h4 mf-outline-h5 mf-outline-h6;
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="3"] {
  counter-increment: mf-outline-h3;
  counter-reset: mf-outline-h4 mf-outline-h5 mf-outline-h6;
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="4"] {
  counter-increment: mf-outline-h4;
  counter-reset: mf-outline-h5 mf-outline-h6;
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="5"] {
  counter-increment: mf-outline-h5;
  counter-reset: mf-outline-h6;
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="6"] {
  counter-increment: mf-outline-h6;
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="1"] .mf-outline-item-text::before {
  content: counter(mf-outline-h1) ". ";
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="2"] .mf-outline-item-text::before {
  content: counter(mf-outline-h1) "." counter(mf-outline-h2) ". ";
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="3"] .mf-outline-item-text::before {
  content: counter(mf-outline-h1) "." counter(mf-outline-h2) "." counter(mf-outline-h3) ". ";
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="4"] .mf-outline-item-text::before {
  content: counter(mf-outline-h1) "." counter(mf-outline-h2) "." counter(mf-outline-h3) "." counter(mf-outline-h4) ". ";
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="5"] .mf-outline-item-text::before {
  content: counter(mf-outline-h1) "." counter(mf-outline-h2) "." counter(mf-outline-h3) "." counter(mf-outline-h4) "." counter(mf-outline-h5) ". ";
}

[data-mf-heading-numbering="true"] .mf-outline-item[data-mf-outline-level="6"] .mf-outline-item-text::before {
  content: counter(mf-outline-h1) "." counter(mf-outline-h2) "." counter(mf-outline-h3) "." counter(mf-outline-h4) "." counter(mf-outline-h5) "." counter(mf-outline-h6) ". ";
}
`.trim()

export function loadLocalHeadingNumberingPreference() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const raw = getStoredValue(window.localStorage, HEADING_NUMBERING_STORAGE_KEY)
    if (!raw) {
      return false
    }

    const parsed = JSON.parse(raw) as Partial<PersistedHeadingNumberingState>
    return parsed.enabled === true
  } catch {
    return false
  }
}

export function persistLocalHeadingNumberingPreference(enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  const nextState: PersistedHeadingNumberingState = {
    enabled,
  }

  setStoredValue(window.localStorage, HEADING_NUMBERING_STORAGE_KEY, JSON.stringify(nextState))
}

function getStoredValue(storage: LooseStorage, key: string) {
  try {
    if (typeof storage.getItem === 'function') {
      const value = storage.getItem(key)
      if (value != null) {
        fallbackStorage.set(key, value)
      }
      return value ?? fallbackStorage.get(key) ?? null
    }
  } catch {
    return fallbackStorage.get(key) ?? null
  }

  return fallbackStorage.get(key) ?? null
}

function setStoredValue(storage: LooseStorage, key: string, value: string) {
  try {
    if (typeof storage.setItem === 'function') {
      storage.setItem(key, value)
    }
  } catch {
    // Fall back to an in-memory store for constrained test environments.
  }

  fallbackStorage.set(key, value)
}
