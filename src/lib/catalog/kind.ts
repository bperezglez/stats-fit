import type { ExerciseKind } from '@/types'
import type { CatalogBodyPart } from '@/lib/catalog/catalog-types'

const CARDIO_EQUIPMENT = new Set([
  'elliptical machine',
  'skierg machine',
  'stationary bike',
  'stepmill machine',
  'upper body ergometer',
])

const TIMED_NAME = /\b(plank|plancha|hold|stretch|mobility|yoga|isometric|warm-up|warm up)\b/i

export function inferExerciseKind(bodyPart: CatalogBodyPart, equipment: string, nameEn: string): ExerciseKind {
  if (bodyPart === 'cardio' || CARDIO_EQUIPMENT.has(equipment)) return 'cardio'
  if (TIMED_NAME.test(nameEn)) return 'timed'
  return 'strength'
}
