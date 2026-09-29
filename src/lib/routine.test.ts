import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTINE } from '@/data/routine'
import { createDefaultRoutineDocument, parseRoutineDocument, routineDayIds } from '@/lib/routine'

describe('parseRoutineDocument', () => {
  it('accepts the default shipped routine', () => {
    const doc = createDefaultRoutineDocument()
    expect(parseRoutineDocument(doc).days).toHaveLength(DEFAULT_ROUTINE.length)
  })

  it('rejects duplicate exercise ids within a day', () => {
    const bad = createDefaultRoutineDocument()
    bad.days[0].exercises.push({ ...bad.days[0].exercises[0] })
    expect(() => parseRoutineDocument(bad)).toThrow(/no válid/)
  })

  it('rejects unknown weekdays', () => {
    const bad = createDefaultRoutineDocument()
    ;(bad.days[0] as { id: string }).id = 'sabado'
    expect(() => parseRoutineDocument(bad)).toThrow(/no válid/)
  })
})

describe('routineDayIds', () => {
  it('lists every weekday in the default routine', () => {
    expect(routineDayIds(DEFAULT_ROUTINE).size).toBe(5)
  })
})
