import type { ExerciseKind } from '@/types'

/** Body-part slug from hasaneyldrm/exercises-dataset. */
export type CatalogBodyPart =
  | 'back'
  | 'cardio'
  | 'chest'
  | 'lower arms'
  | 'lower legs'
  | 'neck'
  | 'shoulders'
  | 'upper arms'
  | 'upper legs'
  | 'waist'

export interface CatalogExercise {
  /** Zero-padded dataset id, e.g. "0043". */
  id: string
  nameEs: string
  nameEn: string
  bodyPart: CatalogBodyPart
  bodyPartLabel: string
  equipment: string
  equipmentLabel: string
  target: string
  kind: ExerciseKind
  /** Spanish steps (from instruction_steps.es). */
  stepsEs: string[]
  /** Paths under `public/catalog/`, e.g. "catalog/images/0001-….jpg". */
  thumb: string
  gif: string
}

export interface CatalogDocument {
  version: 1
  source: 'hasaneyldrm/exercises-dataset'
  attribution: string
  generatedAt: string
  exercises: CatalogExercise[]
}

/** Index file at `/catalog/manifest.json` pointing to chunk files. */
export interface CatalogManifest {
  version: 1
  source: 'hasaneyldrm/exercises-dataset'
  attribution: string
  generatedAt: string
  exerciseCount: number
  /** Paths under `public/`, e.g. "catalog/chunks/001.json". */
  chunks: string[]
}

export interface CatalogChunk {
  exercises: CatalogExercise[]
}
