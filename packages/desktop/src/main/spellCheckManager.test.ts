import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpellCheckManager } from './spellCheckManager'

const { handleMock, removeHandlerMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    removeHandler: removeHandlerMock,
  },
}))

function createSessionStub() {
  const dictionaryWords = new Set<string>()

  return {
    availableSpellCheckerLanguages: ['fr-FR', 'en-US', 'de-DE'],
    setSpellCheckerEnabled: vi.fn(),
    setSpellCheckerLanguages: vi.fn(),
    addWordToSpellCheckerDictionary: vi.fn((word: string) => {
      if (dictionaryWords.has(word)) {
        return false
      }

      dictionaryWords.add(word)
      return true
    }),
    removeWordFromSpellCheckerDictionary: vi.fn((word: string) => {
      if (!dictionaryWords.has(word)) {
        return false
      }

      dictionaryWords.delete(word)
      return true
    }),
  }
}

function createWindowStub(session: ReturnType<typeof createSessionStub>) {
  return {
    webContents: {
      session,
    },
  }
}

describe('SpellCheckManager', () => {
  let tempDir: string

  beforeEach(() => {
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markflow-spellcheck-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('persists selected language and custom dictionary words for the app profile', async () => {
    const firstSession = createSessionStub()
    const manager = new SpellCheckManager(createWindowStub(firstSession) as never, tempDir)

    await manager.initialize()

    expect(manager.getSpellCheckState()).toEqual({
      selectedLanguage: null,
      availableLanguages: ['de-DE', 'en-US', 'fr-FR'],
      customWords: [],
    })

    const nextLanguageState = await manager.setSpellCheckLanguage('de-DE')
    expect(nextLanguageState.selectedLanguage).toBe('de-DE')

    const nextWordState = await manager.addSpellCheckWord('MarkFlow')
    expect(nextWordState).toEqual({
      selectedLanguage: 'de-DE',
      availableLanguages: ['de-DE', 'en-US', 'fr-FR'],
      customWords: ['MarkFlow'],
    })
    expect(firstSession.setSpellCheckerEnabled).toHaveBeenCalledWith(true)
    expect(firstSession.setSpellCheckerLanguages).toHaveBeenLastCalledWith(['de-DE'])
    expect(firstSession.addWordToSpellCheckerDictionary).toHaveBeenCalledWith('MarkFlow')

    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'spellcheck', 'spellcheck-state.json'), 'utf8'),
    ) as { selectedLanguage: string | null; customWords: string[] }
    expect(persisted).toEqual({
      selectedLanguage: 'de-DE',
      customWords: ['MarkFlow'],
    })

    const restoredSession = createSessionStub()
    const restored = new SpellCheckManager(createWindowStub(restoredSession) as never, tempDir)
    await restored.initialize()

    expect(restored.getSpellCheckState()).toEqual({
      selectedLanguage: 'de-DE',
      availableLanguages: ['de-DE', 'en-US', 'fr-FR'],
      customWords: ['MarkFlow'],
    })
    expect(restoredSession.setSpellCheckerLanguages).toHaveBeenCalledWith(['de-DE'])
    expect(restoredSession.addWordToSpellCheckerDictionary).toHaveBeenCalledWith('MarkFlow')
  })

  it('removes custom dictionary words from both persisted state and the session dictionary', async () => {
    const session = createSessionStub()
    const manager = new SpellCheckManager(createWindowStub(session) as never, tempDir)

    await manager.initialize()
    await manager.addSpellCheckWord('Typora')

    const nextState = await manager.removeSpellCheckWord('Typora')
    expect(nextState.customWords).toEqual([])
    expect(session.removeWordFromSpellCheckerDictionary).toHaveBeenCalledWith('Typora')

    const persisted = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'spellcheck', 'spellcheck-state.json'), 'utf8'),
    ) as { selectedLanguage: string | null; customWords: string[] }
    expect(persisted.customWords).toEqual([])
  })
})
