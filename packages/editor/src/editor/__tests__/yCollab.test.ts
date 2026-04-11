import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { mergeYDocs } from '../extensions/yCollab'

describe('Yjs CRDT convergence', () => {
  it('a doc synced to a peer reflects identical text on both sides', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    docA.getText('content').insert(0, '# Hello')

    // Sync A → B
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

    const result = mergeYDocs(docA, docB)
    expect(result).toBe('# Hello')
    expect(docB.getText('content').toString()).toBe('# Hello')
  })

  it('concurrent inserts from two peers converge without source corruption', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    // Bootstrap both with the same base
    const base = '# Title\n'
    docA.getText('content').insert(0, base)
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

    // Peer A appends a paragraph; peer B appends a list — both offline
    docA.getText('content').insert(base.length, '\nParagraph from A.')
    docB.getText('content').insert(base.length, '\n- Item from B.')

    const merged = mergeYDocs(docA, docB)

    // Both additions must appear in the converged text
    expect(merged).toContain('Paragraph from A.')
    expect(merged).toContain('Item from B.')
    // The base must not be duplicated or corrupted
    expect(merged.split('# Title').length - 1).toBe(1)
  })

  it('deleting from one peer and inserting from another converges correctly', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    const base = 'Hello World'
    docA.getText('content').insert(0, base)
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

    // Peer A deletes 'World'
    docA.getText('content').delete(6, 5)
    // Peer B appends '!'
    docB.getText('content').insert(base.length, '!')

    const merged = mergeYDocs(docA, docB)

    // The merged result should contain 'Hello' and '!' but not the deleted 'World'
    expect(merged).toContain('Hello')
    expect(merged).toContain('!')
    expect(merged).not.toContain('World')
  })

  it('markdown source is preserved byte-for-byte after a no-op sync', () => {
    const doc = new Y.Doc()
    const source = '# Heading\n\n**Bold** and *italic*.\n\n```js\nconsole.log(1)\n```\n'
    doc.getText('content').insert(0, source)

    const peer = new Y.Doc()
    const result = mergeYDocs(doc, peer)

    expect(result).toBe(source)
  })
})
