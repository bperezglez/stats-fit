import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authActions, useAuthStore, type AuthUser } from '@/store/auth-store'
import { flushPendingWrites } from '@/store/workout-store'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?'

export function UserMenu({ user }: { user: AuthUser }) {
  const mode = useAuthStore((s) => s.mode)
  const busy = useAuthStore((s) => s.busy)

  const signOut = async () => {
    await flushPendingWrites()
    await authActions.signOut()
    toast('Sesión cerrada')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-lg" className="rounded-full" aria-label={`Cuenta de ${user.name}`} />}
      >
        <Avatar>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-0.5">
            <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
            {user.email && <div className="truncate font-normal">{user.email}</div>}
            <div className="font-normal">{mode === 'supabase' ? 'Cuenta de Google' : 'Perfil local de desarrollo'}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={busy} onClick={signOut}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
