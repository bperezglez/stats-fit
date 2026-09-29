import type { CatalogBodyPart } from '@/lib/catalog/catalog-types'

export const BODY_PART_LABELS: Record<CatalogBodyPart, string> = {
  back: 'Espalda',
  cardio: 'Cardio',
  chest: 'Pecho',
  'lower arms': 'Antebrazos',
  'lower legs': 'Gemelos',
  neck: 'Cuello',
  shoulders: 'Hombros',
  'upper arms': 'Brazos',
  'upper legs': 'Piernas',
  waist: 'Core',
}

export const BODY_PART_ORDER: CatalogBodyPart[] = [
  'chest',
  'back',
  'shoulders',
  'upper legs',
  'upper arms',
  'waist',
  'lower legs',
  'lower arms',
  'cardio',
  'neck',
]

const BODY_PARTS = new Set<string>(Object.keys(BODY_PART_LABELS))

export function isCatalogBodyPart(value: string): value is CatalogBodyPart {
  return BODY_PARTS.has(value)
}
