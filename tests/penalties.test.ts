import { describe, expect, it } from 'vitest'
import { applyPenalties, summarizePenalties } from '@/domain/penalties'

describe('penalties', () => {
  it('sums penalties on time', () => {
    const penalties = [
      { reason: 'Corte de camino', milliseconds: 30000, appliesTo: 'net' as const },
      { reason: 'Drafting', milliseconds: 60000, appliesTo: 'net' as const },
    ]
    const total = applyPenalties(1000, penalties)
    expect(total).toBe(91000)
  })

  it('summarizes penalties for display', () => {
    const summary = summarizePenalties([{ reason: 'Drafting', milliseconds: 60000, appliesTo: 'net' }])
    expect(summary).toContain('Drafting')
  })
})
