import {
  assembleCatalogDocument,
  parseCatalogChunk,
  parseCatalogManifest,
} from '@/lib/catalog/parse'
import type { CatalogDocument, CatalogExercise } from '@/lib/catalog/catalog-types'

let cached: CatalogDocument | null = null
let loadPromise: Promise<CatalogDocument> | null = null

function assetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}${relativePath.replace(/^\/+/, '')}`
}

/** Loads and validates the chunked exercise catalog (cached in memory). */
export async function loadCatalog(): Promise<CatalogDocument> {
  if (cached) return cached
  if (loadPromise) return loadPromise

  loadPromise = fetch(assetUrl('catalog/manifest.json'))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`No se pudo cargar el catálogo (${response.status})`)
      }
      return response.json()
    })
    .then(async (raw) => {
      const manifest = parseCatalogManifest(raw)
      const chunkLists = await Promise.all(
        manifest.chunks.map(async (chunkPath) => {
          const response = await fetch(assetUrl(chunkPath))
          if (!response.ok) {
            throw new Error(`No se pudo cargar ${chunkPath} (${response.status})`)
          }
          const chunkRaw = await response.json()
          return parseCatalogChunk(chunkRaw, chunkPath)
        }),
      )
      cached = assembleCatalogDocument(manifest, chunkLists)
      return cached
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

/** Stable exercise id for logs when an exercise comes from the global catalog. */
export function catalogExerciseId(catalogId: string): string {
  return `ev-${catalogId}`
}

export function catalogExerciseById(
  document: CatalogDocument,
  catalogId: string,
): CatalogExercise | undefined {
  return document.exercises.find((exercise) => exercise.id === catalogId)
}
