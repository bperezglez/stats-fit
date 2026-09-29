export function GymVisualAttribution({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`.trim()}>
      Ilustraciones ©{' '}
      <a
        href="https://www.gymvisual.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Gym visual
      </a>
    </p>
  )
}
