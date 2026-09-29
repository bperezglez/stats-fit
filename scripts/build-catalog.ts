import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BODY_PART_LABELS } from '../src/lib/catalog/body-parts.ts'
import { equipmentLabel } from '../src/lib/catalog/equipment.ts'
import { inferExerciseKind } from '../src/lib/catalog/kind.ts'
import { targetLabel } from '../src/lib/catalog/targets.ts'
import { translateExerciseName } from '../src/lib/catalog/translate-name.ts'
import type { CatalogBodyPart, CatalogExercise, CatalogManifest } from '../src/lib/catalog/catalog-types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const CHUNK_SIZE = 100

interface RawExercise {
  id: string
  name: string
  body_part: string
  equipment: string
  target: string
  image: string
  gif_url: string
  instruction_steps?: { es?: string[] }
}

const ATTRIBUTION =
  'Exercise metadata from hasaneyldrm/exercises-dataset (MIT). Illustrations © Gym visual — see public/catalog/NOTICE.md.'

function resolveInputPath(): string {
  const fromEnv = process.env.EXERCISES_JSON?.trim()
  if (fromEnv) return path.resolve(fromEnv)

  const fromArg = process.argv[2]?.trim()
  if (fromArg) return path.resolve(fromArg)

  return '/tmp/exercises-dataset/data/exercises.json'
}

function toCatalogExercise(raw: RawExercise): CatalogExercise {
  const bodyPart = raw.body_part as CatalogBodyPart
  const stepsEs = raw.instruction_steps?.es?.map((step) => step.trim()).filter(Boolean) ?? []

  return {
    id: raw.id,
    nameEn: raw.name.trim(),
    nameEs: translateExerciseName(raw.name),
    bodyPart,
    bodyPartLabel: BODY_PART_LABELS[bodyPart] ?? raw.body_part,
    equipment: raw.equipment,
    equipmentLabel: equipmentLabel(raw.equipment),
    target: targetLabel(raw.target),
    kind: inferExerciseKind(bodyPart, raw.equipment, raw.name),
    stepsEs,
    thumb: `catalog/${raw.image.replace(/^\/+/, '')}`,
    gif: `catalog/${raw.gif_url.replace(/^\/+/, '')}`,
  }
}

function chunkPath(index: number): string {
  return `catalog/chunks/${String(index + 1).padStart(3, '0')}.json`
}

function main(): void {
  const inputPath = resolveInputPath()
  const outputDir = path.join(repoRoot, 'public/catalog')
  const chunksDir = path.join(outputDir, 'chunks')

  const raw = JSON.parse(readFileSync(inputPath, 'utf8')) as RawExercise[]
  const exercises = raw
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(toCatalogExercise)

  mkdirSync(chunksDir, { recursive: true })

  const chunkPaths: string[] = []
  for (let index = 0; index < exercises.length; index += CHUNK_SIZE) {
    const chunkIndex = chunkPaths.length
    const slice = exercises.slice(index, index + CHUNK_SIZE)
    const relativePath = chunkPath(chunkIndex)
    chunkPaths.push(relativePath)
    writeFileSync(path.join(repoRoot, 'public', relativePath), `${JSON.stringify({ exercises: slice })}\n`, 'utf8')
  }

  const manifest: CatalogManifest = {
    version: 1,
    source: 'hasaneyldrm/exercises-dataset',
    attribution: ATTRIBUTION,
    generatedAt: new Date().toISOString(),
    exerciseCount: exercises.length,
    chunks: chunkPaths,
  }

  writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest)}\n`, 'utf8')

  const totalBytes = chunkPaths.reduce((sum, relativePath) => {
    return sum + readFileSync(path.join(repoRoot, 'public', relativePath)).byteLength
  }, readFileSync(path.join(outputDir, 'manifest.json')).byteLength)

  console.log(
    `Wrote ${exercises.length} exercises in ${chunkPaths.length} chunks → public/catalog/ (${(totalBytes / 1024).toFixed(1)} KiB total)`,
  )
}

main()
