export interface CommandPaletteAction {
  id: string
  label: string
  category: string
  description?: string
  keywords?: string[]
  shortcut?: string
  focusEditorAfterRun?: boolean
  run: () => boolean | void | Promise<boolean | void>
}

export interface RegisteredCommandPaletteAction extends CommandPaletteAction {
  registrationIndex: number
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function scoreFuzzyMatch(field: string, query: string) {
  let queryIndex = 0
  let score = 0
  let consecutiveMatches = 0

  for (let index = 0; index < field.length && queryIndex < query.length; index += 1) {
    if (field[index] !== query[queryIndex]) {
      consecutiveMatches = 0
      continue
    }

    const isWordBoundary = index === 0 || field[index - 1] === ' '
    score += 14 + consecutiveMatches * 6 + (isWordBoundary ? 8 : 0)
    consecutiveMatches += 1
    queryIndex += 1
  }

  if (queryIndex !== query.length) {
    return null
  }

  return score - Math.max(0, field.length - query.length)
}

function scoreSearchField(field: string, query: string) {
  if (field === query) {
    return 1200
  }

  if (field.startsWith(query)) {
    return 1100 - Math.max(0, field.length - query.length)
  }

  const substringIndex = field.indexOf(query)
  if (substringIndex >= 0) {
    return 850 - substringIndex
  }

  const fuzzyScore = scoreFuzzyMatch(field, query)
  if (fuzzyScore === null) {
    return null
  }

  return 500 + fuzzyScore
}

function scoreCommand(action: RegisteredCommandPaletteAction, query: string) {
  const searchFields = [
    { value: action.label, weight: 1.25 },
    { value: action.category, weight: 0.8 },
    { value: action.description ?? '', weight: 0.75 },
    { value: action.shortcut ?? '', weight: 0.7 },
    ...(action.keywords ?? []).map((value) => ({ value, weight: 1 })),
  ]

  let bestScore: number | null = null

  for (const field of searchFields) {
    if (!field.value) {
      continue
    }

    const normalizedField = normalizeSearchValue(field.value)
    const fieldScore = scoreSearchField(normalizedField, query)
    if (fieldScore === null) {
      continue
    }

    const weightedScore = Math.round(fieldScore * field.weight)
    bestScore = bestScore === null ? weightedScore : Math.max(bestScore, weightedScore)
  }

  return bestScore
}

export function registerCommandPaletteActions(
  actions: readonly CommandPaletteAction[],
): RegisteredCommandPaletteAction[] {
  return actions.map((action, registrationIndex) => ({
    ...action,
    registrationIndex,
  }))
}

export function filterCommandPaletteActions(
  actions: readonly CommandPaletteAction[] | readonly RegisteredCommandPaletteAction[],
  rawQuery: string,
) {
  const registeredActions = actions.map((action, index) => ({
    registrationIndex: 'registrationIndex' in action ? action.registrationIndex : index,
    ...action,
  }))
  const query = normalizeSearchValue(rawQuery)

  if (!query) {
    return [...registeredActions].sort(
      (left, right) => left.registrationIndex - right.registrationIndex,
    )
  }

  return registeredActions
    .map((action) => ({
      action,
      score: scoreCommand(action, query),
    }))
    .filter((entry): entry is { action: RegisteredCommandPaletteAction; score: number } => entry.score !== null)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.action.registrationIndex - right.action.registrationIndex
    })
    .map((entry) => entry.action)
}
