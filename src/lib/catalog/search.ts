import type { CatalogBodyPart, CatalogExercise } from '@/lib/catalog/catalog-types'

export interface CatalogSearchFilters {
  query?: string
  bodyPart?: CatalogBodyPart | 'all'
  equipment?: string | 'all'
}

function normalizeQuery(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Filters catalog exercises by text query, body part and equipment slug. */
export function filterCatalogExercises(
  exercises: CatalogExercise[],
  filters: CatalogSearchFilters,
): CatalogExercise[] {
  const query = filters.query ? normalizeQuery(filters.query) : ''
  const bodyPart = filters.bodyPart ?? 'all'
  const equipment = filters.equipment ?? 'all'

  return exercises.filter((exercise) => {
    if (bodyPart !== 'all' && exercise.bodyPart !== bodyPart) return false
    if (equipment !== 'all' && exercise.equipment !== equipment) return false
    if (!query) return true

    const haystack = normalizeQuery(
      [
        exercise.nameEs,
        exercise.nameEn,
        exercise.bodyPartLabel,
        exercise.equipmentLabel,
        exercise.target,
      ].join(' '),
    )

    return query.split(/\s+/).every((token) => haystack.includes(token))
  })
}
