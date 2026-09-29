export const CATALOG_THUMB_SIZE_PX = 240

export function catalogAssetUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/')
  return `${base}${relativePath.replace(/^\/+/, '')}`
}
