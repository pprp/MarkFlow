import { readFileSync } from 'node:fs'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkFlowEditor } from '../MarkFlowEditor'

function mountedStyleText() {
  return Array.from(document.head.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n')
}

function hexLuminance(hex: string) {
  const [r, g, b] = hex
    .slice(1)
    .match(/../g)!
    .map((component) => {
      const value = parseInt(component, 16) / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = hexLuminance(foreground)
  const backgroundLuminance = hexLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

const syntaxVariables = [
  '--mf-syntax-meta',
  '--mf-syntax-keyword',
  '--mf-syntax-constant',
  '--mf-syntax-literal',
  '--mf-syntax-string',
  '--mf-syntax-special',
  '--mf-syntax-definition',
  '--mf-syntax-variable',
  '--mf-syntax-type',
  '--mf-syntax-class',
  '--mf-syntax-special-variable',
  '--mf-syntax-property',
  '--mf-syntax-comment',
  '--mf-syntax-invalid',
]

function readDarkSyntaxVariables() {
  const cssText = readFileSync(`${process.cwd()}/src/styles/global.css`, 'utf8')
  const darkRoot = cssText.match(
    /@media \(prefers-color-scheme: dark\) {\s*:root {([\s\S]*?)\n\s{2}}\n}/,
  )
  expect(darkRoot?.[1]).toBeTruthy()

  const declarations = darkRoot![1]
  const valueFor = (name: string) => {
    const match = declarations.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))
    expect(match?.[1]).toBeTruthy()
    return match![1]
  }

  return {
    background: valueFor('--mf-bg-code'),
    syntax: syntaxVariables.map((name) => [name, valueFor(name)] as const),
  }
}

describe('syntax highlighting theme integration', () => {
  it('uses MarkFlow theme variables for code token colors', () => {
    const { unmount } = render(
      <MarkFlowEditor
        content={['```ts', 'function greet(name: string) {', '  return `Hello ${name}`', '}', '```'].join('\n')}
        viewMode="source"
      />,
    )

    const styleText = mountedStyleText()

    expect(styleText).toContain('var(--mf-syntax-keyword)')
    expect(styleText).toContain('var(--mf-syntax-string)')
    expect(styleText).toContain('var(--mf-syntax-type)')
    expect(styleText).not.toContain('#708')
    expect(styleText).not.toContain('#085')

    unmount()
  })

  it('keeps dark syntax tokens readable against the dark code surface', () => {
    const { background, syntax } = readDarkSyntaxVariables()

    for (const [name, color] of syntax) {
      expect(contrastRatio(color, background), name).toBeGreaterThanOrEqual(4.5)
    }
  })
})
