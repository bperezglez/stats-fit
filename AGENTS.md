# AGENTS.md

Instrucciones para agentes de IA (Cursor, Claude Code, Codex, Copilot…) y personas que trabajen en este repo. Léelo entero antes de tocar código.

## Qué es

**FitTrack**: PWA mínima y rápida para registrar entrenamiento semanal de fuerza, hipertrofia y cardio. Una rutina fija de lunes a viernes; cada ejercicio se registra por series (reps × kg = volumen, o duración/distancia en cardio). Hay gráficos de evolución por ejercicio, vista de progreso y botón para copiar la semana anterior.

- Uso personal, **offline-first**, sin backend ni login. Los datos viven en el navegador (IndexedDB, con fallback a localStorage).
- Toda la interfaz está en **español** (`es-ES`). El código, identificadores y comentarios, en inglés.
- Desplegada en GitHub Pages: `https://bperezglez.github.io/strata-fit/`.

## Stack

| Área | Tecnología |
| --- | --- |
| Build | Vite 8, TypeScript 6 (strict), React 19 |
| Estilos | Tailwind CSS v4 (`@tailwindcss/vite`, sin `tailwind.config`; tokens en `src/index.css`) |
| UI | shadcn/ui estilo **base-nova**, construido sobre **Base UI** (`@base-ui/react`), iconos `lucide-react`, toasts `sonner` |
| Gráficos | Recharts (cargado con `React.lazy`) |
| Persistencia | `idb` (IndexedDB) tras la interfaz `WorkoutRepository` |
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
      index.ts             createRepository(): elige backend
  store/workout-store.ts   estado global + acciones (única fuente de verdad)
  components/
    app-header.tsx         selector de semana + menú de datos
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
- `actions.init()` es idempotente (`initPromise`), porque StrictMode monta dos veces.
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

### Conectar un backend remoto (Supabase/Firebase)

Implementa `WorkoutRepository` en `src/lib/storage/<backend>.ts` y selecciónalo en `createRepository()`. El resto de la app no debe cambiar. Mantén el modo local como fallback sin credenciales y lee las claves de variables `VITE_*` (nunca las subas al repo). Hay un esquema orientativo de tabla en la sección «Conectar un backend» del README.

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

- Sincronización en la nube (Supabase) implementando `WorkoutRepository`.
- Rutina editable desde la app, guardada junto a los datos y con migración de ids.
- Temporizador de descanso entre series.
- Estimación de 1RM y récords personales por ejercicio.
- Tests unitarios (Vitest) para `lib/week.ts`, `lib/metrics.ts` y `parseImport`.
