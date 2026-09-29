# FitTrack

PWA minimalista para registrar entrenamientos de fuerza, hipertrofia y cardio semana a semana (lunes a viernes) y ver la evolución de volumen, peso máximo y repeticiones de cada ejercicio.

- **Sesión diaria**: tarjetas por ejercicio con series (reps × kg) y volumen calculado al momento. Los valores de la semana anterior aparecen como referencia dentro de cada campo.
- **Añadir serie** duplica la última serie para ir más rápido. **Repetir S{n}** copia las series de un ejercicio concreto.
- **Copiar semana anterior**: copia el día completo desde la última semana registrada. Desde el menú ⋮ también puedes copiar la semana entera.
- **Histórico**: pulsa la cabecera de un ejercicio para ver su gráfico (volumen, peso máximo, reps; tiempo y distancia en cardio).
- **Progreso**: volumen semanal apilado por día, minutos de cardio y récords de peso.
- **Acceso con Google**: toda la app está detrás del inicio de sesión. Cada usuario tiene su propio historial, identificado por su id único de usuario, y nunca ve el de otros.
- **Datos**: se guardan en Supabase (Postgres con Row Level Security) asociados a tu cuenta. Exporta/importa JSON desde el menú ⋮.
- **Offline e instalable**: service worker (Workbox) + manifest, así que se puede añadir a la pantalla de inicio.

## Stack

Vite + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), Lucide, Recharts, Supabase (Auth + Postgres), `idb`, `vite-plugin-pwa`.

## Puesta en marcha

Requisitos: Node 20+.

```bash
npm install
cp .env.example .env.local   # opcional: claves de Supabase para entrar con Google
npm run dev                  # http://localhost:47321
```

Sin claves de Supabase, `npm run dev` arranca en **modo local de desarrollo**: en lugar de Google aparece un formulario para crear perfiles de prueba, y cada perfil guarda sus datos en su propia base IndexedDB (`fittrack:{userId}`). Ese modo no es seguro y en un build de producción está desactivado: sin claves, nadie puede entrar.

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

## Autenticación con Google (Supabase)

La sesión la gestiona Supabase Auth con el proveedor de Google (flujo OAuth PKCE). Los datos van a la tabla `workout_logs`, cuya clave primaria es `(user_id, id)`; las políticas de Row Level Security solo permiten leer y escribir filas donde `user_id = auth.uid()`. Es la base de datos, no el cliente, la que impide que se mezclen las estadísticas de distintos usuarios.

### Configuración

1. **Supabase**: crea un proyecto en [supabase.com](https://supabase.com) y ejecuta `supabase/migrations/20260929000000_workout_logs.sql` en el SQL Editor (o `supabase db push` con la CLI).
2. **Google Cloud**: en [console.cloud.google.com](https://console.cloud.google.com) → *APIs y servicios* → *Credenciales*, crea un **ID de cliente OAuth** de tipo *Aplicación web*.
   - Orígenes de JavaScript autorizados: `http://localhost:47321` y tu dominio (p. ej. `https://bperezglez.github.io`).
   - URI de redirección autorizado: `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
   - Configura la pantalla de consentimiento (ámbitos `openid`, `email`, `profile`).
3. **Supabase → Authentication → Sign In / Providers → Google**: activa el proveedor y pega el *Client ID* y el *Client secret*.
4. **Supabase → Authentication → URL Configuration**: *Site URL* = URL pública de la app y añade en *Redirect URLs* `http://localhost:47321/**` y `https://bperezglez.github.io/strata-fit/**`.
5. **Variables**: copia `.env.example` a `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API). Para GitHub Pages, añádelas como *secrets* del repositorio con el mismo nombre; el workflow las inyecta en el build.

La clave publicable es pública por diseño (va en el bundle). Nunca uses la `service_role`/secret key en el cliente.

### Cómo encaja en el código

- `src/store/auth-store.ts`: estado de sesión (Google vía Supabase, perfiles locales en desarrollo o «no configurado»).
- `src/components/auth-gate.tsx`: nada de la app se renderiza ni carga datos sin un usuario autenticado.
- `src/lib/storage/index.ts`: `createRepository(userId)` devuelve un `SupabaseRepository` para ese usuario, o una base local separada por usuario en modo desarrollo.
- Al cerrar sesión se guardan las escrituras pendientes antes de revocar la sesión y se vacía el estado en memoria.
