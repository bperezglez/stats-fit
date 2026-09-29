# AGENTS.md

Instrucciones para agentes de IA (Cursor, Claude Code, Codex, Copilot…) y personas que trabajen en este repo. Léelo entero antes de tocar código.

## Repositorio de trabajo (obligatorio)

- **El único repositorio sobre el que se trabaja es `https://github.com/bperezglez/strata-fit`** (el enlace antiguo `https://github.com/bperezglez/stats-fit` redirige aquí). Todo cambio se hace, se commitea y se empuja a este repositorio de GitHub.
- **No se trabaja sobre ningún otro repositorio**: ni repositorios de curso, plantillas o ejercicios, ni repositorios temporales o vacíos que cree el entorno (p. ej. los de `origin.cursor.com`). Si el workspace no es un clon de este repositorio, clónalo (`git clone https://github.com/bperezglez/strata-fit.git`) y trabaja sobre ese clon.
- Antes de empezar, comprueba con `git remote -v` que `origin` apunta a `github.com/bperezglez/strata-fit`.

## Qué es

**FitTrack**: PWA mínima y rápida para registrar entrenamiento semanal de fuerza, hipertrofia y cardio. Una rutina fija de lunes a viernes; cada ejercicio se registra por series (reps × kg = volumen, o duración/distancia en cardio). Hay gráficos de evolución por ejercicio, vista de progreso y botón para copiar la semana anterior.

- **Multiusuario con login de Google** (Supabase Auth). Toda la app está detrás de `AuthGate`; los datos viven en Supabase (`workout_logs`, RLS por `user_id = auth.uid()`). Sin claves de Supabase, en `npm run dev` hay perfiles locales de desarrollo con una base IndexedDB por usuario; en producción sin claves nadie puede entrar.
- Toda la interfaz está en **español** (`es-ES`). El código, identificadores y comentarios, en inglés.
- Desplegada en GitHub Pages: `https://bperezglez.github.io/strata-fit/`.

## Stack

| Área | Tecnología |
| --- | --- |
| Build | Vite 8, TypeScript 6 (strict), React 19 |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`, sin `tailwind.config`; tokens en `src/index.css`) |
| UI | shadcn/ui estilo **base-nova**, construido sobre **Base UI** (`@base-ui/react`), iconos `lucide-react`, toasts `sonner` |
| Gráficos | Recharts (cargado con `React.lazy`) |
| Auth + datos | Supabase (`@supabase/supabase-js`, Google OAuth PKCE, Postgres + RLS), cargado de forma diferida |
| Persistencia local | `idb` (IndexedDB) para el modo de desarrollo, tras la interfaz `WorkoutRepository` |
| PWA | `vite-plugin-pwa` (`autoUpdate`), iconos con `@vite-pwa/assets-generator` |
| Lint | `oxlint` |

## Comandos

```bash
npm install
npm run icons     # genera los PNG/ICO de public/ a partir de public/logo.svg (no están versionados)
npm run dev       # http://localhost:47321
npm run lint
npm run build     # tsc -b && vite build → dist/
npm run preview   # sirve dist/ en http://localhost:47322
BASE_PATH=/strata-fit/ npm run build   # build igual que en GitHub Pages
```

No hay tests automatizados. **Antes de dar un cambio por terminado: `npm run lint` y `npm run build` deben pasar sin errores**, y hay que probar el flujo afectado en el navegador (idealmente también en viewport móvil, ~390 px).

## Estructura

```
src/
  vite-env.d.ts            tipos de las variables VITE_*
  main.tsx                 entrada (el service worker lo inyecta vite-plugin-pwa como registerSW.js)
  App.tsx                  layout, vista Sesión/Progreso, semana y día activos, flush al ocultar la página
  index.css                tema Tailwind v4 (oscuro fijo, primario lima), fuentes
  types.ts                 modelo de dominio (DayId, ExerciseKind, SetEntry, WorkoutLog, ExportPayload)
  data/routine.ts          ROUTINE: rutina L-V con sus ejercicios; DAY_BY_ID, EXERCISE_BY_ID
  lib/
    week.ts                semanas ISO ("2026-W40"), día actual, navegación entre semanas
    metrics.ts             volumen, estadísticas por ejercicio, deltas, formateo es-ES
    history.ts             serie histórica por ejercicio para los gráficos
    utils.ts               cn() (clsx + tailwind-merge)
    storage/
      repository.ts        interfaz WorkoutRepository (frontera de persistencia)
      indexeddb.ts         implementación IndexedDB
      local-storage.ts     fallback localStorage
      supabase.ts          implementación Supabase (una instancia por usuario)
      index.ts             createRepository(userId): elige backend
    supabase.ts            cliente Supabase (import dinámico) e isSupabaseConfigured
  store/auth-store.ts      sesión: modo supabase / local / unconfigured, login y logout
  store/workout-store.ts   estado global + acciones (única fuente de verdad), inicializado por usuario
  components/
    auth-gate.tsx          protege toda la app; splash, login o error de configuración
    login-screen.tsx       botón de Google (o perfiles locales en desarrollo)
    user-menu.tsx          avatar, datos de la cuenta y cerrar sesión
    app-header.tsx         selector de semana + menú de datos + menú de usuario
    day-tabs.tsx           pestañas L-V con indicador de sesión registrada
    day-session.tsx        sesión del día: lista de ExerciseCard, copiar anterior, vaciar
    exercise-card.tsx      tabla de series editable de un ejercicio
    exercise-history-chart.tsx  gráfico Recharts por ejercicio (lazy)
    progress-view.tsx      vista de progreso global (lazy)
    data-menu.tsx          exportar / importar JSON, borrar todo
    confirm-dialog.tsx, number-field.tsx
    ui/                    primitivas shadcn (generadas; no editar salvo necesidad)
```

## Arquitectura y reglas

### Flujo de datos

`Componentes → actions (store) → WorkoutRepository → IndexedDB/localStorage`

- Los componentes **nunca** acceden al almacenamiento directamente. Leen con `useWorkoutStore(selector)` y escriben solo con `actions.*`.
- El store es un módulo con `useSyncExternalStore`, sin librerías de estado. El estado es inmutable: cada cambio crea objetos nuevos.
- Las escrituras se persisten con **debounce de 250 ms por log**. `flushPendingWrites()` se llama en `visibilitychange`/`pagehide`. Cualquier operación masiva (import, borrar) debe llamar `flushPendingWrites()` o cancelar pendientes antes.
- `actions.init(userId)` es idempotente por usuario (`initPromise`), porque StrictMode monta dos veces. Cambiar de usuario o `actions.reset()` guarda lo pendiente del usuario anterior antes de vaciar el estado.
- Cerrar sesión: `await flushPendingWrites()` **antes** de `authActions.signOut()`, porque sin sesión RLS rechaza las escrituras.
- Un log sin series se elimina (no se guardan sesiones vacías).

### Modelo de datos (contrato estable)

- `WorkoutLog.id = "${weekKey}:${day}"`, p. ej. `"2026-W40:lunes"`. Un log = un día de una semana ISO.
- `weekKey` tiene formato `YYYY-Www` y **se compara como string** para ordenar: mantén el cero a la izquierda.
- `exercises` es `Record<exerciseId, SetEntry[]>`. **Los `id` de ejercicio en `routine.ts` son claves de datos guardados**: renombrarlos o borrarlos deja huérfano el historial del usuario. Para cambiar un nombre visible, cambia `name`, no `id`. Si hay que migrar ids, hazlo con una migración explícita.
- `SetEntry` usa `null` para campos vacíos (no `0`, no `undefined`).
- Tipos de ejercicio (`ExerciseKind`):
  - `strength`: reps + kg; volumen = reps × kg.
  - `timed`: duración (`durationUnit` `s` o `min`) + kg opcional.
  - `cardio`: minutos + km opcional.
- `ExportPayload` (`app: 'fittrack'`, `version: 1`) es el formato de copia de seguridad. Si cambias el modelo, **sube `version`** y mantén `parseImport` compatible con los ficheros antiguos. `parseImport` valida y sanea todo lo importado; no confíes en el JSON de entrada.

### Añadir o cambiar la rutina

Edita solo `src/data/routine.ts`. Cada ejercicio: `id` (kebab-case, único en toda la rutina), `name`, `kind`, `target` (texto libre, p. ej. `"4 × 10-12"`), `cue` opcional. Los días son fijos (`DayId`), así que añadir sábado/domingo implica tocar `DayId`, `ROUTINE`, `week.ts` y `parseImport`.

### Autenticación y aislamiento por usuario

- Nunca renderices contenido de la app ni llames a `actions.*` fuera de `AuthGate`.
- Todo dato de usuario se asocia a `user.id` (UUID de Supabase Auth). En Supabase, cualquier tabla nueva con datos de usuario lleva `user_id uuid references auth.users` y políticas RLS para `select/insert/update/delete` con `(select auth.uid()) = user_id`. Añádela como nueva migración en `supabase/migrations/`.
- Solo la clave publicable (`VITE_SUPABASE_PUBLISHABLE_KEY`) va al cliente. La `service_role` nunca.
- El modo local (`mode === 'local'`) es solo para desarrollo: no es una barrera de seguridad.

## UI y estilo

- **Tema oscuro fijo** (`class="dark"` en `index.html`); no hay modo claro. Usa los tokens semánticos de Tailwind (`bg-background`, `text-muted-foreground`, `border-border`, `text-primary`…), no colores sueltos. El único color por día es `accent` en `routine.ts`.
- Primitivas: usa las de `src/components/ui/`. Para añadir más: `npx shadcn@latest add <componente>`. **Base UI usa la prop `render`, no `asChild`** (p. ej. `<DropdownMenuTrigger render={<Button variant="ghost" />}>`).
- No añadas otra librería de componentes, de estado ni de fechas sin una razón clara.
- **Mobile-first**: el uso principal es en el móvil, en el gimnasio. Objetivos táctiles grandes, `inputMode="decimal"`, respeta los `safe-area-inset`. `NumberField` acepta coma decimal (`72,5`).
- Textos reales en español, tono directo. Cubre los estados vacío, de carga y de error.
- Mantén el bundle inicial ligero: todo lo que use Recharts va con `React.lazy`.

## Convenciones de código

- TypeScript estricto, sin `any`. Alias de import `@/` → `src/`.
- Componentes en `kebab-case.tsx` con export con nombre (las vistas lazy usan `export default`).
- Lógica pura (cálculos, fechas) en `src/lib/`, sin React. La lógica con estado va en el store.
- Estilo existente: sin punto y coma, comillas simples, 2 espacios. Imita el archivo que edites.
- Comentarios solo para explicar restricciones no obvias, no para narrar el código.

## Despliegue

- `.github/workflows/deploy.yml` compila y publica en GitHub Pages en cada push a `main`. Hace `npm install`, luego `npm run icons` y `npm run build` con `BASE_PATH=/<repo>/`.
- `vite.config.ts` lee `BASE_PATH` (por defecto `/`) para `base`, `start_url` y `scope` del manifest. **No uses rutas absolutas a mano** en el código (`/logo.svg`); usa `import.meta.env.BASE_URL` o imports de assets. En `index.html`, Vite reescribe las rutas solo.
- Los iconos PNG/ICO de `public/` y `package-lock.json` pueden no estar en el repo: regenéralos con `npm run icons` / `npm install`.

## Git

- Rama principal: `main`. Commits pequeños, uno por cambio lógico, con mensajes descriptivos en inglés en imperativo (`Add weekly volume chart`).
- No subas `dist/`, `node_modules/` ni secretos.

## Ideas de mejora pendientes

Por si buscas por dónde empezar (confírmalo con el usuario antes de hacer algo grande):

- Caché offline por usuario (IndexedDB) delante de `SupabaseRepository`, con cola de escrituras pendientes.
- Migrar automáticamente a la cuenta los datos que un usuario tenía en el navegador antes del login (hoy: exportar e importar JSON).
- Rutina editable desde la app, guardada junto a los datos y con migración de ids.
- Temporizador de descanso entre series.
- Estimación de 1RM y récords personales por ejercicio.
- Tests unitarios (Vitest) para `lib/week.ts`, `lib/metrics.ts` y `parseImport`.
