import { describe, expect, it } from 'vitest'
import { sessionGuide } from '@/lib/metrics'
import type { SetEntry } from '@/types'

const set = (patch: Partial<SetEntry>): SetEntry => ({
  id: 's',
  reps: null,
  weight: null,
  duration: null,
  distance: null,
  ...patch,
})

describe('sessionGuide', () => {
  const previous = [set({ id: 'a', reps: 10, weight: 40 }), set({ id: 'b', reps: 8, weight: 40 })]

  it('returns the previous sets when this week has nothing logged', () => {
    expect(sessionGuide(undefined, previous)).toEqual(previous)
    expect(sessionGuide([], previous)).toEqual(previous)
  })

  it('stays hidden once this week has its own sets', () => {
    expect(sessionGuide([set({ id: 'hoy', reps: 6, weight: 42 })], previous)).toBeNull()
  })

  it('stays hidden when the previous session has no recorded values', () => {
    expect(sessionGuide([], [set({ id: 'vacio' })])).toBeNull()
    expect(sessionGuide([], undefined)).toBeNull()
  })
})
