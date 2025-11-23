import { Penalty } from './types'

export function applyPenalties(baseTimeMs: number | null | undefined, penalties: Penalty[]) {
  if (baseTimeMs == null) return null
  const total = penalties.reduce((acc, penalty) => acc + penalty.milliseconds, 0)
  return baseTimeMs + total
}

export function summarizePenalties(penalties: Penalty[]) {
  return penalties.map((penalty) => `${penalty.reason} (+${penalty.milliseconds}ms)`).join(', ')
}
