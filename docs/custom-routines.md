# Rutinas personalizadas — análisis de implementación

Documento de diseño para que cada usuario pueda definir su propia rutina semanal desde la app, en lugar de depender de la rutina fija en `src/data/routine.ts`.

## Situación actual

- La rutina vive en código: `src/data/routine.ts` → `ROUTINE`, `DAY_BY_ID`, `EXERCISE_BY_ID`.
- Los entrenamientos guardados referencian ejercicios por `id` (`WorkoutLog.exercises[exerciseId]`).
- Cambiar un `id` de ejercicio **rompe el histórico** de quien ya tenía datos con el id antiguo.
- Los días están acotados a `DayId = 'lunes' | … | 'viernes'` en tipos, pestañas, validación de importación y la tabla `workout_logs` (check constraint en Postgres).

## Objetivo

Que cada usuario pueda:

1. Ver y editar su rutina (días, ejercicios, objetivos, pistas).
2. Tener la rutina disponible offline, igual que los logs.
3. Mantener el histórico de entrenamientos aunque renombre ejercicios o reordene la rutina.
4. (Opcional, fase 2) Compartir o duplicar plantillas.

## Principio clave: separar plantilla de datos históricos

| Concepto | Rol | Cambia con frecuencia |
| --- | --- | --- |
| **Exercise definition** | Metadatos del ejercicio (`name`, `kind`, `target`, `cue`…) | Sí, el usuario edita |
| **Exercise id** | Clave estable en `WorkoutLog.exercises` | **No**, salvo migración explícita |
| **Routine layout** | Qué ejercicios van en qué día y en qué orden | Sí |

Regla: **nunca reutilizar un `id` para otro ejercicio distinto**. Si el usuario “borra” un ejercicio con historial, marcarlo como archivado (`archivedAt`) en lugar de eliminarlo de la base de datos.

## Modelo de datos propuesto

### Tabla `user_routines` (una fila por usuario)

```sql
create table public.user_routines (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  version    int  not null default 1,
  routine    jsonb not null,
  updated_at bigint not null
);
```

`routine` serializa la misma forma que hoy `DayTemplate[]`, pero con ids generados en cliente:

```json
{
  "days": [
    {
      "id": "lunes",
      "short": "L",
      "label": "Lunes",
      "title": "Pierna",
      "focus": "…",
      "accent": "#a3e635",
      "exercises": [
        {
          "id": "ex_8f3a2c1d",
          "name": "Prensa inclinada",
          "kind": "strength",
          "target": "4 × 10-12",
          "cue": "…",
          "archived": false
        }
      ]
    }
  ]
}
```

RLS idéntica a `workout_logs`: `(select auth.uid()) = user_id`.

### Rutina por defecto

- Al crear la fila del usuario (primer login o migración), copiar el contenido actual de `src/data/routine.ts` con los mismos ids kebab-case existentes.
- Así los usuarios actuales no pierden correspondencia con su histórico.

### Ampliar días (sábado / domingo)

Implica cambios coordinados:

1. Ampliar `DayId` en `types.ts`.
2. Relajar el check constraint de `workout_logs.day` (nueva migración).
3. Actualizar `week.ts`, `day-tabs.tsx`, `parseImport`.
4. Decidir si la UI muestra 5 o 7 días por defecto (configurable en la rutina).

Recomendación: permitir **días opcionales** en la rutina (`enabled: boolean` por día) antes de fijar 7 días para todos.

## Capa de aplicación

### Nuevo store: `routine-store.ts`

Análogo a `workout-store.ts`:

- Estado: `routine`, `status`, `sync` (reutilizar `CachedRepository` o un wrapper más pequeño).
- Acciones: `init(userId)`, `addExercise`, `updateExercise`, `archiveExercise`, `reorderExercises`, `updateDayMeta`.
- Validación pura en `lib/routine.ts` (ids únicos, campos obligatorios).

### Sustituir imports estáticos

Hoy muchos componentes importan `ROUTINE` / `EXERCISE_BY_ID` directamente. Pasos:

1. Exponer `useRoutineStore((s) => s.routine)` y selectores derivados (`exerciseById`, `dayById`).
2. Mientras carga, mostrar skeleton o rutina por defecto en memoria (la de `routine.ts` como fallback de solo lectura).
3. `DaySession`, `ProgressView`, gráficos y `copyPreviousWeek` leen la rutina del store, no del fichero.

### Sincronización offline

La rutina encaja en el mismo patrón que los logs:

- Caché IndexedDB `fittrack-cache:{userId}` (misma base, nuevo object store `routine` + outbox separado), **o**
- Segunda fila/tabla con su propio `CachedRepository` apuntando a `user_routines`.

Recomendación: **mismo `CachedRepository`, nuevo object store `routine`** con una sola entrada `{ id: 'routine', payload, updatedAt }` para no multiplicar lógica de sync.

Conflicto remoto: **last-write-wins por `updated_at`**, salvo que haya edición concurrente en dos dispositivos offline — entonces mostrar aviso “Tu rutina cambió en otro dispositivo” y ofrecer recargar (igual que muchas apps de notas).

## Migraciones de ids de ejercicio

Cuando el usuario renombra solo el **nombre**, no hace falta migración.

Si en el futuro se permite “fusionar” dos ejercicios o cambiar el id:

```typescript
interface ExerciseMigration {
  fromId: string
  toId: string
}
```

Proceso:

1. Usuario confirma en UI (“Unir historial de X con Y”).
2. Transacción: actualizar todas las claves en `workout_logs.exercises` del usuario + actualizar rutina.
3. Ejecutar en cliente con `bulkPut` tras leer todos los logs afectados (volumen bajo para un usuario típico).

Para muchos logs, mover la migración a una Edge Function con `service_role` (fuera del alcance inicial).

## UI mínima viable (MVP)

1. **Ajustes → Mi rutina**: lista de días expandibles.
2. Por día: reordenar ejercicios (drag handle), editar nombre/objetivo/pista, cambiar tipo (`strength` / `timed` / `cardio`).
3. Añadir ejercicio: genera `id = ex_${crypto.randomUUID().slice(0, 8)}`.
4. Archivar ejercicio: desaparece de la sesión pero sigue en histórico/gráficos si tiene datos.
5. Restaurar rutina por defecto (confirmación fuerte).

Compartir rutinas y periodización automática quedan fuera del MVP inicial.

## Catálogo global de ejercicios

Integración por fases sobre [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset):

| Fase | Entregable | Estado |
| --- | --- | --- |
| A | `manifest.json` + chunks, `lib/catalog/*`, tests, `NOTICE.md` | **Hecho** |
| B | Picker en el editor de rutina (búsqueda + filtros) | **Hecho** |
| C | Miniaturas/GIF en la UI con atribución Gym visual | **Hecho** |

Modelo en rutina del usuario (futuro):

```typescript
interface ExerciseTemplate {
  id: string           // "ev-0043" estable para logs
  catalogId?: string   // "0043" cuando viene del catálogo
  name: string
  kind: ExerciseKind
  target: string
  cue?: string
  archived?: boolean
}
```

## Orden de implementación sugerido

| Fase | Entregable | Riesgo |
| --- | --- | --- |
| 1 | Migración SQL + `RoutineRepository` + seed desde `routine.ts` | Bajo — **hecho** (`user_routines`, `routine-store`, lectura en UI) |
| 2 | `routine-store` + lectura en UI (sin editor) | Bajo |
| 3 | Editor básico (nombre, target, añadir/archivar) | Medio — **hecho** (pestaña Mi rutina) |
| 4 | Reordenar, días opcionales, sync offline de rutina | Medio |
| 5 | Migración de ids / fusión de ejercicios | Alto |

Estimación de superficie: ~15–20 ficheros tocados, 1 migración SQL, tests en `lib/routine.ts` y en el repositorio de rutina.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Histórico huérfano al borrar ejercicios | Archivar, no borrar; mostrar “Ejercicio eliminado” en gráficos |
| Rutina desincronizada entre dispositivos | `updated_at` + aviso al detectar versión más nueva en pull |
| Bundle más grande | Rutina es JSON pequeño; editor lazy-loaded |
| Complejidad de tests | Mantener validadores puros; Vitest como en `cached.test.ts` |

## Relación con export/import JSON

Extender `ExportPayload` a `version: 2` incluyendo `routine` opcional. `parseImport` v1 sigue importando solo logs; v2 puede restaurar rutina + logs en un solo archivo.

## Conclusión

La implementación es viable reutilizando casi toda la infraestructura recién añadida (caché offline, outbox, RLS por usuario). El trabajo más delicado no es la UI del editor, sino **mantener la estabilidad de los `exerciseId` en el histórico** y migrar la app de una rutina estática a una fuente de verdad por usuario sin romper a quien ya entrena con la rutina actual.

Próximo paso recomendado: **Fase 1** (tabla + seed + lectura en store) en una rama aparte, desplegar, y solo después abrir el editor en la UI.
