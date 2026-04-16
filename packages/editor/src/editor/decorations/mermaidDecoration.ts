import {
  EditorView,
  Decoration,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
  WidgetType,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { getDecorationViewportWindow } from './viewportWindow'

type DiagramLanguage = 'mermaid' | 'sequence' | 'flow'
type IdleHandle = ReturnType<typeof globalThis.setTimeout> | number

const DIAGRAM_FENCE_LANGUAGES = ['mermaid', 'sequence', 'flow'] as const
const FLOW_DIRECTION_HINTS = new Set(['left', 'right', 'up', 'down'])

let mermaidReady: Promise<typeof import('mermaid').default> | null = null

function getMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({ startOnLoad: false, theme: 'default' })
      return mermaid
    })
  }

  return mermaidReady
}

const svgCache = new Map<string, string>()
let renderSerial = 0

function scheduleDiagramRenderOnIdle(callback: () => void): IdleHandle {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(() => callback())
  }

  return globalThis.setTimeout(callback, 16)
}

function cancelDiagramRenderOnIdle(handle: IdleHandle) {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof handle === 'number') {
    window.cancelIdleCallback(handle)
    return
  }

  globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>)
}

function extractFlowLabel(rawLabel: string | undefined, fallbackLabel: string) {
  if (!rawLabel) {
    return fallbackLabel
  }

  const text = rawLabel.split(':>')[0]?.split('|')[0]?.trim()
  return text || fallbackLabel
}

function parseFlowReference(token: string) {
  const match = token.trim().match(/^([A-Za-z0-9_-]+)(?:\(([^)]+)\))?$/u)
  if (!match) {
    throw new Error(`Unsupported flow reference: ${token.trim()}`)
  }

  return {
    id: match[1],
    annotation: match[2]?.trim() ?? null,
  }
}

function extractFlowEdgeLabel(annotation: string | null) {
  if (!annotation) {
    return null
  }

  const labelParts = annotation
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !FLOW_DIRECTION_HINTS.has(part.toLowerCase()))

  return labelParts[0] ?? null
}

function toMermaidFlowNode(nodeId: string, nodeType: string, nodeLabel: string) {
  switch (nodeType) {
    case 'start':
    case 'end':
      return `  ${nodeId}([${nodeLabel}])`
    case 'condition':
      return `  ${nodeId}{${nodeLabel}}`
    case 'input':
    case 'output':
    case 'inputoutput':
      return `  ${nodeId}[/${nodeLabel}/]`
    case 'subroutine':
      return `  ${nodeId}[[${nodeLabel}]]`
    default:
      return `  ${nodeId}[${nodeLabel}]`
  }
}

function transformFlowchartSource(source: string) {
  const trimmedSource = source.trim()
  if (!trimmedSource) {
    throw new Error('Flowcharts cannot be empty.')
  }

  if (/^(flowchart|graph)\b/iu.test(trimmedSource)) {
    return trimmedSource
  }

  const nodes = new Map<string, { type: string; label: string }>()
  const edges: string[] = []

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const definitionMatch = line.match(/^([A-Za-z0-9_-]+)\s*=>\s*([A-Za-z]+)(?:\s*:\s*(.+))?$/u)
    if (definitionMatch) {
      const [, nodeId, nodeType, rawLabel] = definitionMatch
      nodes.set(nodeId, {
        type: nodeType.toLowerCase(),
        label: extractFlowLabel(rawLabel, nodeId),
      })
      continue
    }

    const chain = line
      .split('->')
      .map((part) => part.trim())
      .filter(Boolean)

    if (chain.length < 2) {
      throw new Error(`Unsupported flow line: ${line}`)
    }

    const references = chain.map(parseFlowReference)
    for (let index = 0; index < references.length - 1; index += 1) {
      const from = references[index]
      const to = references[index + 1]
      const label = extractFlowEdgeLabel(from.annotation)

      if (!nodes.has(from.id)) {
        nodes.set(from.id, { type: 'operation', label: from.id })
      }
      if (!nodes.has(to.id)) {
        nodes.set(to.id, { type: 'operation', label: to.id })
      }

      edges.push(label ? `  ${from.id} -->|${label}| ${to.id}` : `  ${from.id} --> ${to.id}`)
    }
  }

  if (nodes.size === 0) {
    throw new Error('Flowcharts must define at least one node.')
  }

  return [
    'flowchart TD',
    ...Array.from(nodes.entries()).map(([nodeId, { type, label }]) =>
      toMermaidFlowNode(nodeId, type, label),
    ),
    ...edges,
  ].join('\n')
}

export function isDiagramFenceLanguage(lang: string): lang is DiagramLanguage {
  return (DIAGRAM_FENCE_LANGUAGES as readonly string[]).includes(lang)
}

export function normalizeDiagramSource(lang: DiagramLanguage, source: string) {
  switch (lang) {
    case 'mermaid':
      return source
    case 'sequence': {
      const trimmedSource = source.trim()
      if (!trimmedSource) {
        throw new Error('Sequence diagrams cannot be empty.')
      }

      if (/^sequenceDiagram\b/iu.test(trimmedSource)) {
        return trimmedSource
      }

      return `sequenceDiagram\n${source}`
    }
    case 'flow':
      return transformFlowchartSource(source)
  }
}

function formatDiagramError(lang: DiagramLanguage, error: unknown) {
  const label = lang === 'mermaid' ? 'Mermaid' : lang === 'sequence' ? 'sequence diagram' : 'flowchart'
  if (error instanceof Error && error.message.trim()) {
    return `Unable to render ${label}: ${error.message.trim()}`
  }

  return `Unable to render ${label}. Switch to Source mode to edit this block.`
}

export function resetDiagramRenderState() {
  mermaidReady = null
  svgCache.clear()
  renderSerial = 0
}

export class DiagramWidget extends WidgetType {
  private renderVersion = 0
  private idleHandle: IdleHandle | null = null

  constructor(
    readonly lang: DiagramLanguage,
    readonly source: string,
    private readonly view: EditorView,
  ) {
    super()
  }

  eq(other: DiagramWidget) {
    return other.lang === this.lang && other.source === this.source
  }

  private isLatestRender(container: HTMLElement, renderVersion: number) {
    return this.renderVersion === renderVersion && container.isConnected
  }

  toDOM() {
    const container = document.createElement('div')
    container.className = `mf-diagram mf-diagram-${this.lang} mf-mermaid`
    container.dataset.diagramLang = this.lang

    const cacheKey = `${this.lang}\u0000${this.source}`
    const cached = svgCache.get(cacheKey)
    if (cached) {
      container.innerHTML = cached
      return container
    }

    container.innerHTML = '<div class="mf-diagram-loading mf-mermaid-loading">⟳ Rendering diagram…</div>'

    const renderVersion = ++this.renderVersion
    const view = this.view
    this.idleHandle = scheduleDiagramRenderOnIdle(() => {
      this.idleHandle = null
      Promise.resolve()
        .then(() => normalizeDiagramSource(this.lang, this.source))
        .then((diagramSource) => {
          const id = `mf-diagram-${renderSerial++}`
          return getMermaid().then((mermaid) => mermaid.render(id, diagramSource))
        })
        .then(({ svg }) => {
          if (!this.isLatestRender(container, renderVersion)) {
            return
          }

          svgCache.set(cacheKey, svg)
          container.innerHTML = svg
          view.requestMeasure()
        })
        .catch((error) => {
          if (!this.isLatestRender(container, renderVersion)) {
            return
          }

          const errorBox = document.createElement('div')
          errorBox.className = 'mf-diagram-error mf-mermaid-error'
          errorBox.textContent = formatDiagramError(this.lang, error)
          container.replaceChildren(errorBox)
          view.requestMeasure()
        })
    })

    return container
  }

  destroy() {
    this.renderVersion += 1
    if (this.idleHandle !== null) {
      cancelDiagramRenderOnIdle(this.idleHandle)
      this.idleHandle = null
    }
  }

  ignoreEvent() {
    return false
  }
}

export function buildDiagramDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  const { from: minFrom, to: maxTo } = getDecorationViewportWindow(view)

  syntaxTree(view.state).iterate({
    from: minFrom,
    to: maxTo,
    enter(node) {
      if (node.name !== 'FencedCode') {
        return
      }

      const infoNode = node.node.getChild('CodeInfo')
      if (!infoNode) {
        return
      }

      const lang = doc.sliceString(infoNode.from, infoNode.to).trim().toLowerCase()
      if (!isDiagramFenceLanguage(lang)) {
        return
      }

      const textNode = node.node.getChild('CodeText')
      if (!textNode) {
        return
      }

      const source = doc.sliceString(textNode.from, textNode.to)
      const firstLine = doc.lineAt(node.from)
      const lastLine = doc.lineAt(node.to)

      builder.add(
        firstLine.from,
        firstLine.to,
        Decoration.replace({ widget: new DiagramWidget(lang, source, view) }),
      )

      for (let lineNum = firstLine.number + 1; lineNum <= lastLine.number - 1; lineNum += 1) {
        const line = doc.line(lineNum)
        builder.add(line.from, line.to, Decoration.replace({}))
      }

      if (lastLine.from !== firstLine.from) {
        builder.add(lastLine.from, lastLine.to, Decoration.replace({}))
      }
    },
  })

  return builder.finish()
}

export function diagramDecorations() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDiagramDecorations(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDiagramDecorations(update.view)
        }
      }
    },
    { decorations: (value) => value.decorations },
  )
}

export const buildMermaidDecorations = buildDiagramDecorations
export const mermaidDecorations = diagramDecorations
