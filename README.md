# FitTrack

PWA minimalista para registrar entrenamientos de fuerza, hipertrofia y cardio semana a semana (lunes a viernes) y ver la evolución de volumen, peso máximo y repeticiones de cada ejercicio.

- **Sesión diaria**: tarjetas por ejercicio con series (reps × kg) y volumen calculado al momento. Los valores de la semana anterior aparecen como referencia dentro de cada campo.
- **Añadir serie** duplica la última serie para ir más rápido. **Repetir S{n}** copia las series de un ejercicio concreto.
- **Copiar semana anterior**: copia el día completo desde la última semana registrada. Desde el menú ⋮ también puedes copiar la semana entera.
- **Histórico**: pulsa la cabecera de un ejercicio para ver su gráfico (volumen, peso máximo, reps; tiempo y distancia en cardio).
- **Progreso**: volumen semanal apilado por día, minutos de cardio y récords de peso.
- **Datos**: se guardan en IndexedDB (localStorage si IndexedDB no está disponible). Exporta/importa JSON desde el menú ⋮.
- **Offline e instalable**: service worker (Workbox) + manifest, así que se puede añadir a la pantalla de inicio.

## Stack

Vite + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Lucide, Recharts, `idb`, `vite-plugin-pwa`.

## Puesta en marcha

Requisitos: Node 20+.

```bash
npm install
npm run dev       # http://localhost:47321
```

Build de producción (el service worker solo se activa aquí):

```bash
npm run build
npm run preview   # http://localhost:47322
```

`npm run lint` ejecuta oxlint.

Los iconos de la PWA (`public/*.png`, `public/favicon.ico`) se generan a partir de `public/logo.svg`. Si faltan o cambias el logo:

```bash
npm run icons
```

## Estructura

```
src/
├── data/routine.ts            Rutina semanal (días, ejercicios, objetivos)
├── types.ts                   Modelo: WorkoutLog = una semana ISO + un día
├── lib/
│   ├── week.ts                Semanas ISO ("2026-W40"), navegación y rangos
│   ├── metrics.ts             Volumen, peso máximo, deltas, formato
│   ├── history.ts             Serie histórica por ejercicio para los gráficos
│   └── storage/               Repositorio de persistencia (IndexedDB / localStorage)
├── store/workout-store.ts     Estado global (useSyncExternalStore) + acciones
└── components/
    ├── day-session.tsx        Vista del día, resumen y "Copiar semana anterior"
    ├── exercise-card.tsx      Registro de series por ejercicio
    ├── exercise-history-chart.tsx  Gráfico de evolución (carga diferida)
    ├── progress-view.tsx      Panel de progreso (carga diferida)
    ├── data-menu.tsx          Exportar / importar / borrar
    └── ui/                    Primitivas de shadcn/ui
```

## Modelo de datos

Cada sesión es un `WorkoutLog` con id `"{semanaISO}:{día}"`, p. ej. `2026-W40:lunes`:

```json
{
  "id": "2026-W40:lunes",
  "weekKey": "2026-W40",
  "day": "lunes",
  "exercises": {
    "prensa-inclinada": [{ "id": "…", "reps": 12, "weight": 80, "duration": null, "distance": null }]
  },
  "updatedAt": 1790000000000
}
```

Los ejercicios de fuerza usan `reps`/`weight`; la plancha y la movilidad usan `duration` (+ `weight` opcional como lastre) y el cardio `duration` (min) y `distance` (km).

Para cambiar la rutina, edita `src/data/routine.ts`. Mantén los `id` de los ejercicios existentes para no perder su histórico.

## Conectar un backend (Supabase / Firebase)

Toda la persistencia pasa por la interfaz `WorkoutRepository` (`src/lib/storage/repository.ts`): `getAll`, `put`, `bulkPut`, `remove`, `clear`. Para sincronizar con la nube:

1. Crea p. ej. `SupabaseRepository` que implemente esa interfaz sobre una tabla `workout_logs` (`id text primary key`, `week_key text`, `day text`, `exercises jsonb`, `updated_at bigint`, `user_id uuid`).
2. Devuélvelo desde `createRepository()` en `src/lib/storage/index.ts` cuando haya sesión iniciada.

El store no necesita cambios: ya agrupa las escrituras (debounce de 250 ms por sesión) y guarda lo pendiente al ocultar o cerrar la pestaña.
