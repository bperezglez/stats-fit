import { describe, expect, it } from 'vitest'
import { assembleCatalogDocument, parseCatalogDocument, parseCatalogManifest } from '@/lib/catalog/parse'
import type { CatalogDocument } from '@/lib/catalog/catalog-types'

function sampleDocument(): CatalogDocument {
  return {
    version: 1,
    source: 'hasaneyldrm/exercises-dataset',
    attribution: 'Test attribution',
    generatedAt: '2026-09-29T00:00:00.000Z',
    exercises: [
      {
        id: '0001',
        nameEs: 'Crunch 3/4',
        nameEn: '3/4 sit-up',
        bodyPart: 'waist',
        bodyPartLabel: 'Core',
        equipment: 'body weight',
        equipmentLabel: 'Peso corporal',
        target: 'Abdominales',
        kind: 'strength',
        stepsEs: ['Paso uno'],
        thumb: 'catalog/images/0001.jpg',
        gif: 'catalog/videos/0001.gif',
      },
    ],
  }
}

describe('parseCatalogDocument', () => {
  it('accepts a valid slim catalog document', () => {
    const parsed = parseCatalogDocument(sampleDocument())
    expect(parsed.exercises).toHaveLength(1)
    expect(parsed.exercises[0].nameEs).toBe('Crunch 3/4')
  })

  it('rejects unsupported versions', () => {
    const bad = { ...sampleDocument(), version: 2 }
    expect(() => parseCatalogDocument(bad)).toThrow(/versión/)
  })

  it('rejects unknown body parts', () => {
    const bad = sampleDocument()
    ;(bad.exercises[0] as { bodyPart: string }).bodyPart = 'wings'
    expect(() => parseCatalogDocument(bad)).toThrow(/bodyPart/)
  })

  it('rejects duplicate exercise ids', () => {
    const bad = sampleDocument()
    bad.exercises.push({ ...bad.exercises[0] })
    expect(() => parseCatalogDocument(bad)).toThrow(/duplicado/)
  })
})

describe('parseCatalogManifest', () => {
  it('assembles exercises from manifest metadata and chunks', () => {
    const manifest = parseCatalogManifest({
      version: 1,
      source: 'hasaneyldrm/exercises-dataset',
      attribution: 'Test',
      generatedAt: '2026-09-29T00:00:00.000Z',
      exerciseCount: 1,
      chunks: ['catalog/chunks/001.json'],
    })

    const document = assembleCatalogDocument(manifest, [sampleDocument().exercises])
    expect(document.exercises).toHaveLength(1)
  })
})
