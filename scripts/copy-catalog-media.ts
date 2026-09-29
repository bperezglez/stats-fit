import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function resolveDatasetRoot(): string {
  const fromEnv = process.env.EXERCISES_DATASET?.trim()
  if (fromEnv) return path.resolve(fromEnv)
  return '/tmp/exercises-dataset'
}

function main(): void {
  const datasetRoot = resolveDatasetRoot()
  const imagesSrc = path.join(datasetRoot, 'images')
  const videosSrc = path.join(datasetRoot, 'videos')
  const imagesDest = path.join(repoRoot, 'public/catalog/images')
  const videosDest = path.join(repoRoot, 'public/catalog/videos')

  if (!existsSync(imagesSrc) || !existsSync(videosSrc)) {
    console.error(`Missing dataset media at ${datasetRoot}. Clone exercises-dataset first.`)
    process.exit(1)
  }

  mkdirSync(imagesDest, { recursive: true })
  mkdirSync(videosDest, { recursive: true })
  cpSync(imagesSrc, imagesDest, { recursive: true })
  cpSync(videosSrc, videosDest, { recursive: true })
  console.log(`Copied catalog media → public/catalog/images and public/catalog/videos`)
}

main()
