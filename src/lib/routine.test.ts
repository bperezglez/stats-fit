import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTINE } from '@/data/routine'
import type { CatalogExercise } from '@/lib/catalog/catalog-types'
import {
  addExerciseToDay,
  createDefaultRoutineDocument,
  createManualExercise,
  enabledDays,
  exerciseFromCatalog,
  exerciseHasLoggedSets,
  isDayEnabled,
  parseRoutineDocument,
  removeOrArchiveExercise,
  reorderExercises,
  restoreDefaultRoutineDocument,
  routineDayIds,
  setDayEnabled,
  setExerciseArchived,
  updateDayMeta,
  updateExerciseInDay,
} from '@/lib/routine'
import type { WorkoutLog } from '@/types'

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

  it('renames a day without changing its id', () => {
    const doc = createDefaultRoutineDocument()
    const exerciseIds = doc.days[1].exercises.map((e) => e.id)
    const updated = updateDayMeta(doc, 'martes', {
      label: 'Pecho',
      title: 'Empuje',
      focus: 'Press y espalda',
      short: 'Ma',
    })
    expect(updated.days[1]).toMatchObject({
      id: 'martes',
      label: 'Pecho',
      title: 'Empuje',
      focus: 'Press y espalda',
      short: 'Ma',
    })
    expect(updated.days[1].exercises.map((e) => e.id)).toEqual(exerciseIds)
    expect(doc.days[1].label).toBe('Martes')
  })

  it('rejects an empty day label and an oversized short name', () => {
    const doc = createDefaultRoutineDocument()
    expect(() => updateDayMeta(doc, 'lunes', { label: '   ' })).toThrow(/nombre del día/)
    expect(() => updateDayMeta(doc, 'lunes', { short: 'Lunes' })).toThrow(/3 caracteres/)
    expect(updateDayMeta(doc, 'lunes', { focus: '   ' }).days[0].focus).toBe('')
  })

  it('reorders exercises and keeps every id', () => {
    const doc = createDefaultRoutineDocument()
    const ids = doc.days[0].exercises.map((e) => e.id)
    const moved = reorderExercises(doc, 'lunes', 0, 2)
    expect(moved.days[0].exercises.map((e) => e.id)).toEqual([ids[1], ids[2], ids[0], ...ids.slice(3)])
    expect(moved.days[0].id).toBe('lunes')
    expect(reorderExercises(doc, 'lunes', 1, 1)).toBe(doc)
    expect(() => reorderExercises(doc, 'lunes', 0, 99)).toThrow(/posición/)
  })

  it('removes an exercise that was never logged', () => {
    let doc = createDefaultRoutineDocument()
    const manual = createManualExercise({ name: 'Sin historial' })
    doc = addExerciseToDay(doc, 'jueves', manual)
    const result = removeOrArchiveExercise(doc, 'jueves', manual.id, false)
    expect(result.action).toBe('removed')
    expect(result.doc.days.flatMap((d) => d.exercises).some((e) => e.id === manual.id)).toBe(false)
  })

  it('archives an exercise that has logged sets instead of deleting it', () => {
    const doc = createDefaultRoutineDocument()
    const id = doc.days[0].exercises[0].id
    const result = removeOrArchiveExercise(doc, 'lunes', id, true)
    expect(result.action).toBe('archived')
    const kept = result.doc.days[0].exercises.find((e) => e.id === id)
    expect(kept?.archived).toBe(true)
    expect(kept?.name).toBe(doc.days[0].exercises[0].name)
  })
})

describe('exerciseHasLoggedSets', () => {
  const log: WorkoutLog = {
    id: '2026-W40:lunes',
    weekKey: '2026-W40',
    day: 'lunes',
    exercises: {
      prensa: [{ id: 's1', reps: 10, weight: 40, duration: null, distance: null }],
      vacio: [{ id: 's2', reps: null, weight: null, duration: null, distance: null }],
    },
    updatedAt: 1,
  }

  it('is true only when a set has a recorded value', () => {
    expect(exerciseHasLoggedSets([log], 'prensa')).toBe(true)
    expect(exerciseHasLoggedSets([log], 'vacio')).toBe(false)
    expect(exerciseHasLoggedSets([log], 'otro')).toBe(false)
  })
})

describe('optional days', () => {
  it('hides a disabled day and keeps its id', () => {
    let doc = createDefaultRoutineDocument()
    doc = setDayEnabled(doc, 'viernes', false)
    expect(doc.days[4].id).toBe('viernes')
    expect(doc.days[4].enabled).toBe(false)
    expect(isDayEnabled(doc.days[4])).toBe(false)
    expect(enabledDays(doc.days).map((d) => d.id)).toEqual(['lunes', 'martes', 'miercoles', 'jueves'])
    expect(parseRoutineDocument(doc).days[4].enabled).toBe(false)
    expect(parseRoutineDocument(doc).days[0].enabled).toBeUndefined()
  })

  it('refuses to disable the last active day', () => {
    let doc = createDefaultRoutineDocument()
    for (const id of ['lunes', 'martes', 'miercoles', 'jueves'] as const) {
      doc = setDayEnabled(doc, id, false)
    }
    expect(() => setDayEnabled(doc, 'viernes', false)).toThrow(/al menos un día/)
    expect(isDayEnabled(doc.days[4])).toBe(true)
  })

  it('enables a day again by dropping the flag', () => {
    let doc = setDayEnabled(createDefaultRoutineDocument(), 'miercoles', false)
    doc = setDayEnabled(doc, 'miercoles', true)
    expect(doc.days[2].enabled).toBeUndefined()
    expect(isDayEnabled(doc.days[2])).toBe(true)
  })
})
