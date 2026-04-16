import { BrowserWindow, ipcMain } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { MarkFlowSpellCheckState } from '@markflow/shared'

type PersistedSpellCheckState = {
  selectedLanguage?: string | null
  customWords?: string[]
}

type ResolvedSpellCheckState = {
  selectedLanguage: string | null
  customWords: string[]
}

const DEFAULT_STATE: ResolvedSpellCheckState = {
  selectedLanguage: null,
  customWords: [],
}

const FALLBACK_LANGUAGES = ['de-DE', 'en-GB', 'en-US', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-BR']

function normalizeWord(word: string) {
  const trimmed = word.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toSortedUniqueWords(words: readonly string[]) {
  const nextWords = new Map<string, string>()

  for (const word of words) {
    const normalized = normalizeWord(word)
    if (!normalized) {
      continue
    }

    const key = normalized.toLocaleLowerCase()
    if (!nextWords.has(key)) {
      nextWords.set(key, normalized)
    }
  }

  return [...nextWords.values()].sort((left, right) => left.localeCompare(right))
}

function toSortedUniqueLanguages(languages: readonly string[]) {
  return [...new Set(languages.filter((language) => language.trim().length > 0))].sort((left, right) =>
    left.localeCompare(right),
  )
}

export class SpellCheckManager {
  private readonly stateDir: string
  private readonly statePath: string
  private state: ResolvedSpellCheckState = { ...DEFAULT_STATE }

  constructor(
    private window: BrowserWindow,
    userDataPath: string,
  ) {
    this.stateDir = path.join(userDataPath, 'spellcheck')
    this.statePath = path.join(this.stateDir, 'spellcheck-state.json')
  }

  registerIpcHandlers() {
    ipcMain.removeHandler('get-spellcheck-state')
    ipcMain.removeHandler('set-spellcheck-language')
    ipcMain.removeHandler('add-spellcheck-word')
    ipcMain.removeHandler('remove-spellcheck-word')

    ipcMain.handle('get-spellcheck-state', () => this.getSpellCheckState())
    ipcMain.handle('set-spellcheck-language', async (_event, language: string | null) =>
      this.setSpellCheckLanguage(language),
    )
    ipcMain.handle('add-spellcheck-word', async (_event, word: string) => this.addSpellCheckWord(word))
    ipcMain.handle('remove-spellcheck-word', async (_event, word: string) =>
      this.removeSpellCheckWord(word),
    )
  }

  async initialize() {
    this.ensureStateDirectory()
    const persistedState = this.readPersistedState()
    this.state = {
      selectedLanguage: this.resolveLanguage(persistedState.selectedLanguage ?? null),
      customWords: toSortedUniqueWords(persistedState.customWords ?? []),
    }
    this.persistState()
    this.applyStateToSession()
  }

  getSpellCheckState(): MarkFlowSpellCheckState {
    return {
      selectedLanguage: this.state.selectedLanguage,
      availableLanguages: this.getAvailableLanguages(),
      customWords: [...this.state.customWords],
    }
  }

  async setSpellCheckLanguage(language: string | null): Promise<MarkFlowSpellCheckState> {
    this.ensureStateDirectory()
    this.state = {
      ...this.state,
      selectedLanguage: this.resolveLanguage(language),
    }
    this.persistState()
    this.applySelectedLanguageToSession()
    return this.getSpellCheckState()
  }

  async addSpellCheckWord(word: string): Promise<MarkFlowSpellCheckState> {
    this.ensureStateDirectory()
    const normalized = normalizeWord(word)
    if (!normalized) {
      return this.getSpellCheckState()
    }

    const existingWord = this.findStoredWord(normalized)
    if (existingWord) {
      return this.getSpellCheckState()
    }

    const didAdd = this.window.webContents.session.addWordToSpellCheckerDictionary(normalized)
    if (!didAdd) {
      return this.getSpellCheckState()
    }

    this.state = {
      ...this.state,
      customWords: toSortedUniqueWords([...this.state.customWords, normalized]),
    }
    this.persistState()
    return this.getSpellCheckState()
  }

  async removeSpellCheckWord(word: string): Promise<MarkFlowSpellCheckState> {
    this.ensureStateDirectory()
    const normalized = normalizeWord(word)
    if (!normalized) {
      return this.getSpellCheckState()
    }

    const existingWord = this.findStoredWord(normalized)
    if (!existingWord) {
      return this.getSpellCheckState()
    }

    const didRemove = this.window.webContents.session.removeWordFromSpellCheckerDictionary(existingWord)
    if (!didRemove) {
      return this.getSpellCheckState()
    }

    this.state = {
      ...this.state,
      customWords: this.state.customWords.filter((currentWord) => currentWord !== existingWord),
    }
    this.persistState()
    return this.getSpellCheckState()
  }

  private ensureStateDirectory() {
    fs.mkdirSync(this.stateDir, { recursive: true })
  }

  private readPersistedState(): PersistedSpellCheckState {
    try {
      const raw = fs.readFileSync(this.statePath, 'utf8')
      return JSON.parse(raw) as PersistedSpellCheckState
    } catch {
      return { ...DEFAULT_STATE }
    }
  }

  private persistState() {
    fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf8')
  }

  private applyStateToSession() {
    this.applySelectedLanguageToSession()

    for (const word of this.state.customWords) {
      this.window.webContents.session.addWordToSpellCheckerDictionary(word)
    }
  }

  private applySelectedLanguageToSession() {
    const session = this.window.webContents.session
    session.setSpellCheckerEnabled(true)
    session.setSpellCheckerLanguages(this.state.selectedLanguage ? [this.state.selectedLanguage] : [])
  }

  private getAvailableLanguages() {
    const sessionLanguages = this.window.webContents.session.availableSpellCheckerLanguages
    const available = Array.isArray(sessionLanguages) && sessionLanguages.length > 0
      ? sessionLanguages
      : FALLBACK_LANGUAGES

    return toSortedUniqueLanguages(available)
  }

  private resolveLanguage(language: string | null) {
    if (!language) {
      return null
    }

    return this.getAvailableLanguages().includes(language) ? language : null
  }

  private findStoredWord(word: string) {
    const lowerWord = word.toLocaleLowerCase()
    return (
      this.state.customWords.find((currentWord) => currentWord.toLocaleLowerCase() === lowerWord) ?? null
    )
  }
}
