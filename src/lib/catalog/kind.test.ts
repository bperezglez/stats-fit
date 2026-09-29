import { describe, expect, it } from 'vitest'
import { inferExerciseKind } from '@/lib/catalog/kind'

describe('inferExerciseKind', () => {
  it('marks cardio body parts as cardio', () => {
    expect(inferExerciseKind('cardio', 'body weight', 'run')).toBe('cardio')
  })

  it('marks cardio machines as cardio', () => {
    expect(inferExerciseKind('upper legs', 'stationary bike', 'bike')).toBe('cardio')
  })

  it('marks planks and holds as timed', () => {
    expect(inferExerciseKind('waist', 'body weight', 'front plank')).toBe('timed')
    expect(inferExerciseKind('back', 'body weight', 'stretch hold')).toBe('timed')
  })

  it('defaults to strength for typical lifts', () => {
    expect(inferExerciseKind('chest', 'barbell', 'bench press')).toBe('strength')
    expect(inferExerciseKind('upper legs', 'barbell', 'barbell squat')).toBe('strength')
  })
})
