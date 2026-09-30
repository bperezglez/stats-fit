import { useState } from 'react'
import { cn } from '@/lib/utils'

const toDraft = (v: number | null) => (v == null ? '' : String(v).replace('.', ','))

function parse(draft: string): number | null | undefined {
  const t = draft.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

interface NumberFieldProps {
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  label: string
  integer?: boolean
  className?: string
  onFocus?: () => void
}

/**
 * Accepts both "," and "." as decimal separators and keeps the raw text while
 * typing so intermediate states like "22," aren't clobbered.
 */
export function NumberField({ value, onChange, placeholder, label, integer, className, onFocus }: NumberFieldProps) {
  const [draft, setDraft] = useState(() => toDraft(value))
  const [synced, setSynced] = useState(value)

  if (synced !== value) {
    setSynced(value)
    if (parse(draft) !== value) setDraft(toDraft(value))
  }

  return (
    <input
      aria-label={label}
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      enterKeyHint="next"
      value={draft}
      placeholder={placeholder}
      onFocus={(e) => {
        onFocus?.()
        e.currentTarget.select()
      }}
      onChange={(e) => {
        const next = integer ? e.target.value.replace(/[^\d]/g, '') : e.target.value.replace(/[^\d.,]/g, '')
        setDraft(next)
        const parsed = parse(next)
        if (parsed !== undefined && parsed !== value) {
          setSynced(parsed)
          onChange(parsed)
        }
      }}
      className={cn(
        'h-10 w-full min-w-0 rounded-lg border border-input bg-background/60 px-2 text-center text-base font-semibold tabular-nums outline-none transition-colors',
        'placeholder:font-normal placeholder:text-muted-foreground/50 focus:border-primary/70 focus:bg-background focus:ring-2 focus:ring-primary/25',
        className,
      )}
    />
  )
}
