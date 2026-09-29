import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTINE } from '@/data/routine'
import type { CatalogExercise } from '@/lib/catalog/catalog-types'
import {
  addExerciseToDay,
  createDefaultRoutineDocument,
  createManualExercise,
  exerciseFromCatalog,
  parseRoutineDocument,
  restoreDefaultRoutineDocument,
  routineDayIds,
  setExerciseArchived,
  updateExerciseInDay,
} from '@/lib/routine'

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

  it('rejects duplicate exercise ids across days', () => {
    const bad = createDefaultRoutineDocument()
    bad.days[1].exercises.push({ ...bad.days[0].exercises[0] })
    expect(() => parseRoutineDocument(bad)).toThrow(/duplicados/)
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

describe('exerciseFromCatalog', () => {
  it('uses stable ev-XXXX ids and copies catalog metadata', () => {
    const item: CatalogExercise = {
      id: '0043',
      nameEs: 'Press banca',
      nameEn: 'Bench press',
      bodyPart: 'chest',
      bodyPartLabel: 'Pecho',
      equipment: 'barbell',
      equipmentLabel: 'Barra',
      target: 'Pectorales',
      kind: 'strength',
      stepsEs: ['Apoya los pies'],
      thumb: 'catalog/images/0043.jpg',
      gif: 'catalog/videos/0043.gif',
    }
    const template = exerciseFromCatalog(item)
    expect(template.id).toBe('ev-0043')
    expect(template.catalogId).toBe('0043')
    expect(template.catalogThumb).toBe(item.thumb)
    expect(template.catalogGif).toBe(item.gif)
    expect(template.cue).toBe('Apoya los pies')
  })
})

describe('createManualExercise', () => {
  it('generates ids with ex_ prefix', () => {
    const exercise = createManualExercise()
    expect(exercise.id).toMatch(/^ex_[a-z0-9-]{8}$/i)
  })
})

describe('routine mutations', () => {
  it('adds, updates, archives and restores exercises', () => {
    let doc = createDefaultRoutineDocument()
    const manual = createManualExercise({ name: 'Test extra' })
    doc = addExerciseToDay(doc, 'lunes', manual)
    expect(doc.days[0].exercises.some((e) => e.id === manual.id)).toBe(true)

    doc = updateExerciseInDay(doc, 'lunes', manual.id, { target: '5 × 5', cue: 'Pausa abajo' })
    const updated = doc.days[0].exercises.find((e) => e.id === manual.id)
    expect(updated?.target).toBe('5 × 5')
    expect(updated?.cue).toBe('Pausa abajo')

    doc = setExerciseArchived(doc, 'lunes', manual.id, true)
    expect(doc.days[0].exercises.find((e) => e.id === manual.id)?.archived).toBe(true)

    doc = setExerciseArchived(doc, 'lunes', manual.id, false)
    expect(doc.days[0].exercises.find((e) => e.id === manual.id)?.archived).toBeUndefined()
  })

  it('rejects duplicate ids when adding', () => {
    const doc = createDefaultRoutineDocument()
    const existing = doc.days[0].exercises[0]
    expect(() => addExerciseToDay(doc, 'martes', existing)).toThrow(/identificador/)
  })

  it('restores the default routine document', () => {
    let doc = createDefaultRoutineDocument()
    doc = addExerciseToDay(doc, 'lunes', createManualExercise())
    const restored = restoreDefaultRoutineDocument()
    expect(restored.days).toHaveLength(DEFAULT_ROUTINE.length)
    expect(restored.days[0].exercises).toHaveLength(DEFAULT_ROUTINE[0].exercises.length)
  })
})
