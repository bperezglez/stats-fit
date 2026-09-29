import type {
  CatalogBodyPart,
  CatalogDocument,
  CatalogExercise,
  CatalogManifest,
} from '@/lib/catalog/catalog-types'
import { isCatalogBodyPart } from '@/lib/catalog/body-parts'
import type { ExerciseKind } from '@/types'

const KINDS = new Set<ExerciseKind>(['strength', 'timed', 'cardio'])

function parseExercise(raw: unknown, index: number): CatalogExercise {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Ejercicio ${index}: formato no válido`)
  }

  const item = raw as Record<string, unknown>
  const id = item.id
  const nameEs = item.nameEs
  const nameEn = item.nameEn
  const bodyPart = item.bodyPart
  const bodyPartLabel = item.bodyPartLabel
  const equipment = item.equipment
  const equipmentLabel = item.equipmentLabel
  const target = item.target
  const kind = item.kind
  const stepsEs = item.stepsEs
  const thumb = item.thumb
  const gif = item.gif

  if (typeof id !== 'string' || !/^\d{4}$/.test(id)) {
    throw new Error(`Ejercicio ${index}: id no válido`)
  }
  if (typeof nameEs !== 'string' || !nameEs.trim()) {
    throw new Error(`Ejercicio ${index}: nameEs obligatorio`)
  }
  if (typeof nameEn !== 'string' || !nameEn.trim()) {
    throw new Error(`Ejercicio ${index}: nameEn obligatorio`)
  }
  if (typeof bodyPart !== 'string' || !isCatalogBodyPart(bodyPart)) {
    throw new Error(`Ejercicio ${index}: bodyPart no válido`)
  }
  if (typeof bodyPartLabel !== 'string' || !bodyPartLabel.trim()) {
    throw new Error(`Ejercicio ${index}: bodyPartLabel obligatorio`)
  }
  if (typeof equipment !== 'string' || !equipment.trim()) {
    throw new Error(`Ejercicio ${index}: equipment obligatorio`)
  }
  if (typeof equipmentLabel !== 'string' || !equipmentLabel.trim()) {
    throw new Error(`Ejercicio ${index}: equipmentLabel obligatorio`)
  }
  if (typeof target !== 'string' || !target.trim()) {
    throw new Error(`Ejercicio ${index}: target obligatorio`)
  }
  if (typeof kind !== 'string' || !KINDS.has(kind as ExerciseKind)) {
    throw new Error(`Ejercicio ${index}: kind no válido`)
  }
  if (!Array.isArray(stepsEs) || !stepsEs.every((step) => typeof step === 'string')) {
    throw new Error(`Ejercicio ${index}: stepsEs debe ser un array de strings`)
  }
  if (typeof thumb !== 'string' || !thumb.startsWith('catalog/')) {
    throw new Error(`Ejercicio ${index}: thumb no válido`)
  }
  if (typeof gif !== 'string' || !gif.startsWith('catalog/')) {
    throw new Error(`Ejercicio ${index}: gif no válido`)
  }

  return {
    id,
    nameEs: nameEs.trim(),
    nameEn: nameEn.trim(),
    bodyPart: bodyPart as CatalogBodyPart,
    bodyPartLabel: bodyPartLabel.trim(),
    equipment: equipment.trim(),
    equipmentLabel: equipmentLabel.trim(),
    target: target.trim(),
    kind: kind as ExerciseKind,
    stepsEs: stepsEs.map((step) => step.trim()).filter(Boolean),
    thumb,
    gif,
  }
}

export function parseCatalogManifest(raw: unknown): CatalogManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Catálogo: manifiesto no válido')
  }

  const doc = raw as Record<string, unknown>
  if (doc.version !== 1) {
    throw new Error('Catálogo: versión no soportada')
  }
  if (doc.source !== 'hasaneyldrm/exercises-dataset') {
    throw new Error('Catálogo: fuente no reconocida')
  }
  if (typeof doc.attribution !== 'string' || !doc.attribution.trim()) {
    throw new Error('Catálogo: atribución obligatoria')
  }
  if (typeof doc.generatedAt !== 'string' || !doc.generatedAt.trim()) {
    throw new Error('Catálogo: generatedAt obligatorio')
  }
  if (typeof doc.exerciseCount !== 'number' || doc.exerciseCount < 1) {
    throw new Error('Catálogo: exerciseCount no válido')
  }
  if (!Array.isArray(doc.chunks) || doc.chunks.length === 0) {
    throw new Error('Catálogo: chunks vacío')
  }
  if (!doc.chunks.every((chunk) => typeof chunk === 'string' && chunk.startsWith('catalog/'))) {
    throw new Error('Catálogo: chunks no válidos')
  }

  return {
    version: 1,
    source: 'hasaneyldrm/exercises-dataset',
    attribution: doc.attribution.trim(),
    generatedAt: doc.generatedAt.trim(),
    exerciseCount: doc.exerciseCount,
    chunks: doc.chunks as string[],
  }
}

export function parseCatalogChunk(raw: unknown, chunkPath: string): CatalogExercise[] {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Catálogo: chunk ${chunkPath} no válido`)
  }

  const chunk = raw as Record<string, unknown>
  if (!Array.isArray(chunk.exercises) || chunk.exercises.length === 0) {
    throw new Error(`Catálogo: chunk ${chunkPath} vacío`)
  }

  return chunk.exercises.map((item, index) => parseExercise(item, index))
}

export function assembleCatalogDocument(
  manifest: CatalogManifest,
  chunkLists: CatalogExercise[][],
): CatalogDocument {
  const exercises = chunkLists.flat()
  if (exercises.length !== manifest.exerciseCount) {
    throw new Error('Catálogo: recuento de ejercicios no coincide con el manifiesto')
  }

  const ids = new Set<string>()
  for (const exercise of exercises) {
    if (ids.has(exercise.id)) {
      throw new Error(`Catálogo: id duplicado ${exercise.id}`)
    }
    ids.add(exercise.id)
  }

  return {
    version: manifest.version,
    source: manifest.source,
    attribution: manifest.attribution,
    generatedAt: manifest.generatedAt,
    exercises,
  }
}

/** Validates a monolithic catalog JSON document (tests and legacy tooling). */
export function parseCatalogDocument(raw: unknown): CatalogDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Catálogo: documento no válido')
  }

  const doc = raw as Record<string, unknown>
  if (doc.version !== 1) {
    throw new Error('Catálogo: versión no soportada')
  }
  if (doc.source !== 'hasaneyldrm/exercises-dataset') {
    throw new Error('Catálogo: fuente no reconocida')
  }
  if (typeof doc.attribution !== 'string' || !doc.attribution.trim()) {
    throw new Error('Catálogo: atribución obligatoria')
  }
  if (typeof doc.generatedAt !== 'string' || !doc.generatedAt.trim()) {
    throw new Error('Catálogo: generatedAt obligatorio')
  }
  if (!Array.isArray(doc.exercises) || doc.exercises.length === 0) {
    throw new Error('Catálogo: exercises vacío')
  }

  const exercises = doc.exercises.map((item, index) => parseExercise(item, index))
  const ids = new Set<string>()
  for (const exercise of exercises) {
    if (ids.has(exercise.id)) {
      throw new Error(`Catálogo: id duplicado ${exercise.id}`)
    }
    ids.add(exercise.id)
  }

  return {
    version: 1,
    source: 'hasaneyldrm/exercises-dataset',
    attribution: doc.attribution.trim(),
    generatedAt: doc.generatedAt.trim(),
    exercises,
  }
}
