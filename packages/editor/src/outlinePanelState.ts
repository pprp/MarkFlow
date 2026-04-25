import type { OutlineHeading } from './editor/outline'

export interface OutlineTreeNode {
  heading: OutlineHeading
  children: OutlineTreeNode[]
}

export function filterOutlineHeadings(
  headings: readonly OutlineHeading[],
  query: string,
): OutlineHeading[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return [...headings]
  }

  return headings.filter((heading) => heading.text.toLowerCase().includes(normalizedQuery))
}

export function buildOutlineTree(headings: readonly OutlineHeading[]): OutlineTreeNode[] {
  const roots: OutlineTreeNode[] = []
  const stack: OutlineTreeNode[] = []

  for (const heading of headings) {
    const node: OutlineTreeNode = {
      heading,
      children: [],
    }

    while (stack.length > 0 && stack.at(-1)!.heading.level >= heading.level) {
      stack.pop()
    }

    if (stack.length > 0) {
      stack.at(-1)!.children.push(node)
    } else {
      roots.push(node)
    }

    stack.push(node)
  }

  return roots
}

export function findOutlineAncestorAnchors(
  headings: readonly OutlineHeading[],
  targetAnchor: string | null,
): string[] {
  if (!targetAnchor) {
    return []
  }

  const stack: OutlineHeading[] = []

  for (const heading of headings) {
    while (stack.length > 0 && stack.at(-1)!.level >= heading.level) {
      stack.pop()
    }

    if (heading.anchor === targetAnchor) {
      return stack.map((ancestor) => ancestor.anchor)
    }

    stack.push(heading)
  }

  return []
}
