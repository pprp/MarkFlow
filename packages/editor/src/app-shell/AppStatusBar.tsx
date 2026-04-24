import {
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useDeferredValue,
  useMemo,
} from 'react'
import type { MarkFlowImageUploadSettings, MarkFlowSpellCheckState } from '@markflow/shared'
import { formatMarkdownModeStatus, type MarkFlowMarkdownMode } from '../markdownMode'
import { sanitizeSpellCheckWord } from '../spellCheckProfile'
import type { MarkFlowStatisticsPreferences } from '../statisticsPreferences'
import { computeStats } from '../editor/wordCount'
import type { DocumentTabState } from './documents'
import type { StatusBarPanelsController } from './useStatusBarPanels'

function formatSpellCheckLanguageLabel(language: string | null) {
  return language ?? 'Default'
}

function formatHeadingNumberingStatus(enabled: boolean) {
  return enabled ? 'Headings: 1.2' : 'Headings: Plain'
}

function formatSourceLineNumbersStatus(enabled: boolean) {
  return enabled ? 'Source lines: On' : 'Source lines: Off'
}

function formatReadingTime(minutes: number, suffix: 'panel' | 'statusbar' = 'panel') {
  const label = `${minutes.toLocaleString()} min`
  return suffix === 'statusbar' ? `${label} read` : label
}

function formatImageUploadStatus(settings: MarkFlowImageUploadSettings | null) {
  if (!settings || !settings.autoUploadOnInsert || settings.uploaderKind === 'disabled') {
    return 'Uploads: Off'
  }

  return settings.uploaderKind === 'picgo-core' ? 'Uploads: PicGo' : 'Uploads: Custom'
}

type AppStatusBarProps = {
  activeTab: DocumentTabState | null
  currentLineNumber: number
  totalLines: number
  markdownMode: MarkFlowMarkdownMode
  statisticsPreferences: MarkFlowStatisticsPreferences
  updateStatisticsPreferences: (nextPreferences: MarkFlowStatisticsPreferences) => void
  updateMarkdownModePreference: (mode: MarkFlowMarkdownMode) => void
  headingNumberingEnabled: boolean
  updateHeadingNumberingPreference: (enabled: boolean) => void
  sourceLineNumbersEnabled: boolean
  updateSourceLineNumbersPreference: (enabled: boolean) => void
  spellCheckState: MarkFlowSpellCheckState
  handleSpellCheckLanguageChange: (event: ChangeEvent<HTMLSelectElement>) => Promise<void>
  spellCheckWordInput: string
  setSpellCheckWordInput: Dispatch<SetStateAction<string>>
  handleSpellCheckWordSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleSpellCheckWordRemove: (word: string) => Promise<void>
  imageUploadSettings: MarkFlowImageUploadSettings | null
  updateImageUploadSettings: (patch: Partial<MarkFlowImageUploadSettings>) => void
  panelState: StatusBarPanelsController
}

export function AppStatusBar({
  activeTab,
  currentLineNumber,
  totalLines,
  markdownMode,
  statisticsPreferences,
  updateStatisticsPreferences,
  updateMarkdownModePreference,
  headingNumberingEnabled,
  updateHeadingNumberingPreference,
  sourceLineNumbersEnabled,
  updateSourceLineNumbersPreference,
  spellCheckState,
  handleSpellCheckLanguageChange,
  spellCheckWordInput,
  setSpellCheckWordInput,
  handleSpellCheckWordSubmit,
  handleSpellCheckWordRemove,
  imageUploadSettings,
  updateImageUploadSettings,
  panelState,
}: AppStatusBarProps) {
  const deferredContent = useDeferredValue(activeTab?.content ?? '')
  const deferredSelectionText = useDeferredValue(activeTab?.selectionText ?? '')
  const docStats = useMemo(
    () =>
      computeStats(deferredContent, deferredSelectionText, {
        excludeFencedCode: statisticsPreferences.excludeFencedCode,
      }),
    [deferredContent, deferredSelectionText, statisticsPreferences.excludeFencedCode],
  )
  const hasSelectionStats = deferredSelectionText.length > 0
  const selectionLineCount = hasSelectionStats ? deferredSelectionText.split('\n').length : 0
  const statisticsRows = [
    {
      label: 'Words',
      documentValue: docStats.words.toLocaleString(),
      selectionValue: docStats.selectionWords.toLocaleString(),
    },
    {
      label: 'Lines',
      documentValue: docStats.lines.toLocaleString(),
      selectionValue: selectionLineCount.toLocaleString(),
    },
    {
      label: 'Characters',
      documentValue: docStats.chars.toLocaleString(),
      selectionValue: docStats.selectionChars.toLocaleString(),
    },
    {
      label: 'Characters (no spaces)',
      documentValue: docStats.charsNoSpaces.toLocaleString(),
      selectionValue: docStats.selectionCharsNoSpaces.toLocaleString(),
    },
    {
      label: 'Paragraphs',
      documentValue: docStats.paragraphs.toLocaleString(),
      selectionValue: docStats.selectionParagraphs.toLocaleString(),
    },
    {
      label: 'Reading time',
      documentValue: formatReadingTime(docStats.readingMinutes),
      selectionValue: formatReadingTime(docStats.selectionReadingMinutes),
    },
  ]

  return (
    <footer className="mf-statusbar" aria-label="Document statistics">
      <button
        ref={panelState.documentStatisticsButtonRef}
        type="button"
        className={`mf-statusbar-summary${panelState.isDocumentStatisticsOpen ? ' mf-statusbar-summary-active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={panelState.isDocumentStatisticsOpen}
        aria-label={panelState.isDocumentStatisticsOpen ? 'Hide document statistics' : 'Show document statistics'}
        onClick={() => {
          panelState.toggleDocumentStatistics()
        }}
      >
        <span className="mf-statusbar-stat">{docStats.words.toLocaleString()} words</span>
        <span className="mf-statusbar-sep" aria-hidden="true">·</span>
        <span className="mf-statusbar-stat">{docStats.lines.toLocaleString()} lines</span>
        <span className="mf-statusbar-sep" aria-hidden="true">·</span>
        <span className="mf-statusbar-stat">{docStats.chars.toLocaleString()} characters</span>
        <span className="mf-statusbar-sep" aria-hidden="true">·</span>
        <span className="mf-statusbar-stat">{formatReadingTime(docStats.readingMinutes, 'statusbar')}</span>
        {activeTab?.largeFile ? (
          <>
            <span className="mf-statusbar-sep" aria-hidden="true">·</span>
            <span className="mf-statusbar-stat">
              line {currentLineNumber.toLocaleString()} / {totalLines.toLocaleString()}
            </span>
            <span className="mf-statusbar-sep" aria-hidden="true">·</span>
            <span className="mf-statusbar-stat">
              window {activeTab.largeFile.windowStartLine.toLocaleString()}-{activeTab.largeFile.windowEndLine.toLocaleString()}
            </span>
          </>
        ) : null}
        {hasSelectionStats ? (
          <>
            <span className="mf-statusbar-sep" aria-hidden="true">|</span>
            <span className="mf-statusbar-stat mf-statusbar-selection">
              sel: {docStats.selectionWords}w / {docStats.selectionChars}c
            </span>
          </>
        ) : null}
      </button>
      {panelState.isDocumentStatisticsOpen ? (
        <section
          ref={panelState.documentStatisticsPanelRef}
          className="mf-statistics-popover"
          role="dialog"
          aria-label="Document statistics"
        >
          <div className="mf-spellcheck-popover-header">
            <div>
              <p className="mf-spellcheck-popover-title">Document Statistics</p>
              <p className="mf-spellcheck-popover-copy">
                Live totals update as you edit. Selection metrics appear when text is highlighted.
              </p>
            </div>
          </div>
          <table className="mf-statistics-table">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Document</th>
                {hasSelectionStats ? <th scope="col">Selection</th> : null}
              </tr>
            </thead>
            <tbody>
              {statisticsRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.documentValue}</td>
                  {hasSelectionStats ? <td>{row.selectionValue}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          <label className="mf-image-upload-checkbox">
            <input
              type="checkbox"
              checked={statisticsPreferences.excludeFencedCode}
              onChange={(event) =>
                updateStatisticsPreferences({
                  ...statisticsPreferences,
                  excludeFencedCode: event.target.checked,
                })
              }
            />
            <span>Exclude fenced code blocks from counts</span>
          </label>
          {!hasSelectionStats ? (
            <p className="mf-statistics-copy">Select one or more blocks to compare document and selection totals.</p>
          ) : null}
          <p className="mf-statistics-copy">
            Words ignore markdown formatting markers. Character counts keep source punctuation inside the included text.
          </p>
        </section>
      ) : null}
      <div className="mf-statusbar-actions">
        <button
          ref={panelState.markdownModeButtonRef}
          type="button"
          className={`mf-statusbar-button${panelState.isMarkdownModeSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={panelState.isMarkdownModeSettingsOpen}
          aria-label="Markdown mode settings"
          onClick={panelState.toggleMarkdownModeSettings}
        >
          {formatMarkdownModeStatus(markdownMode)}
        </button>
        {panelState.isMarkdownModeSettingsOpen ? (
          <section
            ref={panelState.markdownModePanelRef}
            className="mf-spellcheck-popover"
            role="dialog"
            aria-label="Markdown mode settings"
          >
            <div className="mf-spellcheck-popover-header">
              <div>
                <p className="mf-spellcheck-popover-title">Markdown Mode</p>
                <p className="mf-spellcheck-popover-copy">
                  Strict mode follows GFM-style heading whitespace and ordered-list indentation
                  more closely. The choice is remembered for the next launch.
                </p>
              </div>
            </div>
            <label className="mf-image-upload-checkbox">
              <input
                type="radio"
                name="markdown-mode"
                checked={markdownMode === 'tolerant'}
                onChange={() => updateMarkdownModePreference('tolerant')}
              />
              <span>Tolerant markdown parsing</span>
            </label>
            <label className="mf-image-upload-checkbox">
              <input
                type="radio"
                name="markdown-mode"
                checked={markdownMode === 'strict'}
                onChange={() => updateMarkdownModePreference('strict')}
              />
              <span>Strict markdown parsing</span>
            </label>
          </section>
        ) : null}
        <button
          ref={panelState.headingNumberingButtonRef}
          type="button"
          className={`mf-statusbar-button${panelState.isHeadingNumberingSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={panelState.isHeadingNumberingSettingsOpen}
          aria-label="Heading numbering settings"
          onClick={panelState.toggleHeadingNumberingSettings}
        >
          {formatHeadingNumberingStatus(headingNumberingEnabled)}
        </button>
        {panelState.isHeadingNumberingSettingsOpen ? (
          <section
            ref={panelState.headingNumberingPanelRef}
            className="mf-spellcheck-popover"
            role="dialog"
            aria-label="Heading numbering settings"
          >
            <div className="mf-spellcheck-popover-header">
              <div>
                <p className="mf-spellcheck-popover-title">Heading Numbering</p>
                <p className="mf-spellcheck-popover-copy">
                  Adds CSS-counter prefixes to rendered headings, the outline, and HTML/PDF exports
                  without rewriting the markdown source.
                </p>
              </div>
            </div>
            <label className="mf-image-upload-checkbox">
              <input
                type="checkbox"
                checked={headingNumberingEnabled}
                onChange={(event) => updateHeadingNumberingPreference(event.target.checked)}
              />
              <span>Enable heading auto-numbering</span>
            </label>
          </section>
        ) : null}
        <button
          ref={panelState.sourceLineNumbersButtonRef}
          type="button"
          className={`mf-statusbar-button${panelState.isSourceLineNumbersSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={panelState.isSourceLineNumbersSettingsOpen}
          aria-label="Source line-number settings"
          onClick={panelState.toggleSourceLineNumbersSettings}
        >
          {formatSourceLineNumbersStatus(sourceLineNumbersEnabled)}
        </button>
        {panelState.isSourceLineNumbersSettingsOpen ? (
          <section
            ref={panelState.sourceLineNumbersPanelRef}
            className="mf-spellcheck-popover"
            role="dialog"
            aria-label="Source line-number settings"
          >
            <div className="mf-spellcheck-popover-header">
              <div>
                <p className="mf-spellcheck-popover-title">Source Line Numbers</p>
                <p className="mf-spellcheck-popover-copy">
                  Shows a 1-based gutter only in Source mode so raw markdown keeps line context
                  without adding chrome to Preview, Reading, or Split views.
                </p>
              </div>
            </div>
            <label className="mf-image-upload-checkbox">
              <input
                type="checkbox"
                checked={sourceLineNumbersEnabled}
                onChange={(event) => updateSourceLineNumbersPreference(event.target.checked)}
              />
              <span>Show line numbers in source mode</span>
            </label>
          </section>
        ) : null}
        {imageUploadSettings ? (
          <>
            <button
              ref={panelState.imageUploadButtonRef}
              type="button"
              className={`mf-statusbar-button${panelState.isImageUploadSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
              aria-haspopup="dialog"
              aria-expanded={panelState.isImageUploadSettingsOpen}
              aria-label="Image upload preferences"
              onClick={panelState.toggleImageUploadSettings}
            >
              {formatImageUploadStatus(imageUploadSettings)}
            </button>
            {panelState.isImageUploadSettingsOpen ? (
              <section
                ref={panelState.imageUploadPanelRef}
                className="mf-image-upload-popover"
                role="dialog"
                aria-label="Image upload preferences"
              >
                <div className="mf-spellcheck-popover-header">
                  <div>
                    <p className="mf-spellcheck-popover-title">Image Upload</p>
                    <p className="mf-spellcheck-popover-copy">
                      Auto-routes pasted and dropped images through PicGo-compatible commands.
                    </p>
                  </div>
                </div>
                <label className="mf-image-upload-checkbox">
                  <input
                    type="checkbox"
                    checked={imageUploadSettings.autoUploadOnInsert}
                    onChange={(event) =>
                      updateImageUploadSettings({ autoUploadOnInsert: event.target.checked })
                    }
                  />
                  <span>Upload pasted and dropped images automatically</span>
                </label>
                <label className="mf-spellcheck-field">
                  <span className="mf-spellcheck-field-label">Uploader preset</span>
                  <select
                    className="mf-theme-select"
                    value={imageUploadSettings.uploaderKind}
                    onChange={(event) =>
                      updateImageUploadSettings({
                        uploaderKind: event.target.value as MarkFlowImageUploadSettings['uploaderKind'],
                      })
                    }
                    aria-label="Image uploader type"
                  >
                    <option value="disabled">Disabled</option>
                    <option value="picgo-core">PicGo Core</option>
                    <option value="custom-command">Custom command</option>
                  </select>
                </label>
                {imageUploadSettings.uploaderKind !== 'disabled' ? (
                  <>
                    <label className="mf-spellcheck-field">
                      <span className="mf-spellcheck-field-label">Command</span>
                      <input
                        className="mf-spellcheck-input"
                        type="text"
                        value={imageUploadSettings.command}
                        onChange={(event) =>
                          updateImageUploadSettings({ command: event.target.value })
                        }
                        placeholder={imageUploadSettings.uploaderKind === 'picgo-core' ? 'picgo' : '/path/to/upload-image'}
                        aria-label="Image uploader command"
                      />
                    </label>
                    <label className="mf-spellcheck-field">
                      <span className="mf-spellcheck-field-label">Arguments</span>
                      <input
                        className="mf-spellcheck-input"
                        type="text"
                        value={imageUploadSettings.arguments}
                        onChange={(event) =>
                          updateImageUploadSettings({ arguments: event.target.value })
                        }
                        placeholder={imageUploadSettings.uploaderKind === 'picgo-core' ? 'upload' : '--flag value'}
                        aria-label="Image uploader arguments"
                      />
                    </label>
                    <label className="mf-spellcheck-field">
                      <span className="mf-spellcheck-field-label">Asset directory</span>
                      <input
                        className="mf-spellcheck-input"
                        type="text"
                        value={imageUploadSettings.assetDirectoryName}
                        onChange={(event) =>
                          updateImageUploadSettings({ assetDirectoryName: event.target.value })
                        }
                        placeholder="assets"
                        aria-label="Image asset directory"
                      />
                    </label>
                    <label className="mf-spellcheck-field">
                      <span className="mf-spellcheck-field-label">Timeout (ms)</span>
                      <input
                        className="mf-spellcheck-input"
                        type="number"
                        min={1000}
                        step={1000}
                        value={imageUploadSettings.timeoutMs}
                        onChange={(event) =>
                          updateImageUploadSettings({
                            timeoutMs: Number.parseInt(event.target.value || '0', 10),
                          })
                        }
                        aria-label="Image upload timeout"
                      />
                    </label>
                    <label className="mf-image-upload-checkbox">
                      <input
                        type="checkbox"
                        checked={imageUploadSettings.keepLocalCopyAfterUpload}
                        onChange={(event) =>
                          updateImageUploadSettings({
                            keepLocalCopyAfterUpload: event.target.checked,
                          })
                        }
                      />
                      <span>Keep the managed local copy after a successful upload</span>
                    </label>
                    <p className="mf-image-upload-copy">
                      {'`${filename}` and `${filepath}` expand against the current markdown file, and the image path is appended as the final command argument.'}
                    </p>
                  </>
                ) : (
                  <p className="mf-image-upload-copy">
                    Enable a preset to rewrite inserted local images to remote URLs while keeping a local
                    fallback on upload failure.
                  </p>
                )}
              </section>
            ) : null}
          </>
        ) : null}
        <button
          ref={panelState.spellCheckButtonRef}
          type="button"
          className={`mf-statusbar-button${panelState.isSpellCheckSettingsOpen ? ' mf-statusbar-button-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={panelState.isSpellCheckSettingsOpen}
          aria-label="Spellcheck settings"
          onClick={panelState.toggleSpellCheckSettings}
        >
          Spell: {formatSpellCheckLanguageLabel(spellCheckState.selectedLanguage)}
        </button>
        {panelState.isSpellCheckSettingsOpen ? (
          <section
            ref={panelState.spellCheckPanelRef}
            className="mf-spellcheck-popover"
            role="dialog"
            aria-label="Spellcheck settings"
          >
            <div className="mf-spellcheck-popover-header">
              <div>
                <p className="mf-spellcheck-popover-title">Spellcheck</p>
                <p className="mf-spellcheck-popover-copy">Applies to this MarkFlow profile.</p>
              </div>
            </div>
            <label className="mf-spellcheck-field">
              <span className="mf-spellcheck-field-label">Dictionary language</span>
              <select
                className="mf-theme-select"
                value={spellCheckState.selectedLanguage ?? ''}
                onChange={(event) => void handleSpellCheckLanguageChange(event)}
                aria-label="Spellcheck language"
              >
                <option value="">Default</option>
                {spellCheckState.availableLanguages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </label>
            <form className="mf-spellcheck-add-form" onSubmit={(event) => void handleSpellCheckWordSubmit(event)}>
              <label className="mf-spellcheck-field">
                <span className="mf-spellcheck-field-label">Custom dictionary</span>
                <input
                  className="mf-spellcheck-input"
                  type="text"
                  value={spellCheckWordInput}
                  onChange={(event) => setSpellCheckWordInput(event.target.value)}
                  placeholder="Add a domain term"
                  aria-label="Add custom spellcheck word"
                />
              </label>
              <button
                type="submit"
                className="mf-spellcheck-submit"
                disabled={sanitizeSpellCheckWord(spellCheckWordInput) == null}
              >
                Add word
              </button>
            </form>
            <div className="mf-spellcheck-word-list" aria-label="Custom spellcheck words">
              {spellCheckState.customWords.length > 0 ? (
                spellCheckState.customWords.map((word) => (
                  <button
                    key={word}
                    type="button"
                    className="mf-spellcheck-word-chip"
                    aria-label={`Remove ${word} from custom dictionary`}
                    onClick={() => void handleSpellCheckWordRemove(word)}
                  >
                    <span>{word}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))
              ) : (
                <p className="mf-spellcheck-empty">No custom words yet.</p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </footer>
  )
}
