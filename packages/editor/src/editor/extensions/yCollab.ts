import * as Y from 'yjs'
import { yCollab as yCmCollab } from 'y-codemirror.next'
import type { Extension } from '@codemirror/state'

export interface YCollabOptions {
  /** Shared Y.Doc instance to use */
  ydoc: Y.Doc
  /** Name of the Y.Text field in the doc (defaults to 'content') */
  fieldName?: string
}

/**
 * Returns a CodeMirror extension that binds the editor to a Yjs shared document.
 * The initial content of the editor is pushed into the Y.Text on first bind.
 * Subsequent edits from any peer are reflected automatically via CRDT merge.
 */
export function yCollabExtension({ ydoc, fieldName = 'content' }: YCollabOptions): Extension {
  const yText = ydoc.getText(fieldName)
  return yCmCollab(yText, null)
}

/**
 * Merge two independent Y.Doc instances that share the same document ID
 * by exchanging encoded state vectors. Returns the converged text value.
 *
 * Useful in tests to simulate two peers exchanging a single round of updates.
 */
export function mergeYDocs(docA: Y.Doc, docB: Y.Doc, fieldName = 'content'): string {
  const stateA = Y.encodeStateAsUpdate(docA)
  const stateB = Y.encodeStateAsUpdate(docB)
  Y.applyUpdate(docA, stateB)
  Y.applyUpdate(docB, stateA)
  return docA.getText(fieldName).toString()
}
