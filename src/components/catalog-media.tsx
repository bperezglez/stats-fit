import { useState } from 'react'
import { Dumbbell, Play } from 'lucide-react'
import { GymVisualAttribution } from '@/components/gym-visual-attribution'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CATALOG_THUMB_SIZE_PX, catalogAssetUrl } from '@/lib/catalog/media'
import { cn } from '@/lib/utils'

interface CatalogThumbnailProps {
  thumb?: string
  alt: string
  size?: 'sm' | 'md'
  className?: string
}

export function CatalogThumbnail({ thumb, alt, size = 'md', className }: CatalogThumbnailProps) {
  const [failed, setFailed] = useState(false)
  const dimension = size === 'sm' ? 56 : 72

  if (!thumb || failed) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground',
          className,
        )}
        style={{ width: dimension, height: dimension }}
        aria-hidden
      >
        <Dumbbell className={size === 'sm' ? 'size-4' : 'size-5'} />
      </div>
    )
  }

  return (
    <img
      src={catalogAssetUrl(thumb)}
      alt={alt}
      width={dimension}
      height={dimension}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('shrink-0 rounded-lg border border-border bg-muted/20 object-cover', className)}
      style={{ width: dimension, height: dimension, maxWidth: CATALOG_THUMB_SIZE_PX, maxHeight: CATALOG_THUMB_SIZE_PX }}
    />
  )
}

interface CatalogMediaPreviewProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  thumb?: string
  gif?: string
}

export function CatalogMediaPreview({ open, onOpenChange, name, thumb, gif }: CatalogMediaPreviewProps) {
  const [gifFailed, setGifFailed] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>Vista previa del ejercicio</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {gif && !gifFailed ? (
            <img
              src={catalogAssetUrl(gif)}
              alt={`Animación de ${name}`}
              width={CATALOG_THUMB_SIZE_PX}
              height={CATALOG_THUMB_SIZE_PX}
              onError={() => setGifFailed(true)}
              className="rounded-xl border border-border object-cover"
              style={{ width: CATALOG_THUMB_SIZE_PX, height: CATALOG_THUMB_SIZE_PX }}
            />
          ) : (
            <CatalogThumbnail thumb={thumb} alt={name} size="md" className="!size-[180px]" />
          )}
          <GymVisualAttribution />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function CatalogPreviewButton({
  name,
  thumb,
  gif,
  className,
}: {
  name: string
  thumb?: string
  gif?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (!thumb && !gif) return null

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Ver animación de ${name}`}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Play />
      </Button>
      <CatalogMediaPreview open={open} onOpenChange={setOpen} name={name} thumb={thumb} gif={gif} />
    </>
  )
}
