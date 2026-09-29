import type { DayId, DayTemplate, ExerciseTemplate } from '@/types'

export const ROUTINE: DayTemplate[] = [
  {
    id: 'lunes',
    short: 'L',
    label: 'Lunes',
    title: 'Pierna',
    focus: 'Foco cuádriceps & glúteo',
    accent: '#a3e635',
    exercises: [
      { id: 'prensa-inclinada', name: 'Prensa inclinada', kind: 'strength', target: '4 × 10-12', cue: 'Pies a media altura, bajada controlada 3 s' },
      { id: 'sentadilla-goblet', name: 'Sentadilla Goblet', kind: 'strength', target: '3 × 10-12', cue: 'Torso erguido, rodillas siguiendo la punta del pie' },
      { id: 'curl-femoral', name: 'Curl femoral', kind: 'strength', target: '3 × 12' },
      { id: 'extension-cuadriceps', name: 'Extensión de cuádriceps', kind: 'strength', target: '3 × 12-15', cue: 'Pausa de 1 s arriba' },
      { id: 'gemelos', name: 'Gemelos', kind: 'strength', target: '4 × 15' },
      { id: 'cardio-cinta-lunes', name: 'Cardio cinta', kind: 'cardio', target: '20 min inclinación', cue: 'Zona 2: puedes hablar sin ahogarte' },
    ],
  },
  {
    id: 'martes',
    short: 'M',
    label: 'Martes',
    title: 'Torso hombro-safe',
    focus: 'Espalda & pecho guiado + estabilidad',
    accent: '#38bdf8',
    exercises: [
      { id: 'remo-maquina-apoyo', name: 'Remo en máquina con apoyo pectoral', kind: 'strength', target: '4 × 10', cue: 'Escápulas atrás y abajo antes de tirar' },
      { id: 'jalon-pecho', name: 'Jalón al pecho', kind: 'strength', target: '3 × 10-12' },
      { id: 'press-pecho-guiado', name: 'Press de pecho guiado', kind: 'strength', target: '3 × 10', cue: 'Codos a 45°, sin bloquear arriba' },
      { id: 'rotacion-externa-polea', name: 'Rotación externa en polea', kind: 'strength', target: '3 × 15', cue: 'Codo pegado al cuerpo, peso ligero' },
      { id: 'face-pulls', name: 'Face pulls', kind: 'strength', target: '3 × 15' },
      { id: 'cardio-bici-martes', name: 'Cardio bicicleta', kind: 'cardio', target: '20 min' },
    ],
  },
  {
    id: 'miercoles',
    short: 'X',
    label: 'Miércoles',
    title: 'Cadera, glúteos & core',
    focus: 'Cadena posterior y anti-rotación',
    accent: '#f472b6',
    exercises: [
      { id: 'hip-thrust', name: 'Hip thrust', kind: 'strength', target: '4 × 10', cue: 'Pausa de 2 s arriba, mentón recogido' },
      { id: 'peso-muerto-rumano-mancuernas', name: 'Peso muerto rumano con mancuernas', kind: 'strength', target: '3 × 10' },
      { id: 'abductores', name: 'Abductores', kind: 'strength', target: '3 × 15' },
      { id: 'press-pallof', name: 'Press Pallof', kind: 'strength', target: '3 × 12 por lado' },
      { id: 'plancha-frontal', name: 'Plancha frontal', kind: 'timed', durationUnit: 's', target: '3 × 40 s' },
      { id: 'cardio-hiit-bici', name: 'Cardio HIIT bicicleta', kind: 'cardio', target: '10 × 30" / 60"' },
    ],
  },
  {
    id: 'jueves',
    short: 'J',
    label: 'Jueves',
    title: 'Espalda & brazos',
    focus: 'Brazos adaptados + estabilidad de hombro',
    accent: '#fb923c',
    exercises: [
      { id: 'remo-unilateral-polea', name: 'Remo unilateral en polea', kind: 'strength', target: '3 × 12 por lado' },
      { id: 'pajaro-pec-deck-inverso', name: 'Pájaro en Pec Deck inverso', kind: 'strength', target: '3 × 15' },
      { id: 'triceps-polea', name: 'Tríceps en polea', kind: 'strength', target: '3 × 12' },
      { id: 'biceps-curl', name: 'Curl de bíceps', kind: 'strength', target: '3 × 12' },
      { id: 'serrato-punch', name: 'Serrato punch', kind: 'strength', target: '3 × 15' },
      { id: 'ytw-banco-inclinado', name: 'Y-T-W en banco inclinado', kind: 'strength', target: '2 × 8 por letra', cue: 'Peso muy ligero, control total' },
      { id: 'cardio-cinta-jueves', name: 'Cardio cinta', kind: 'cardio', target: '20 min' },
    ],
  },
  {
    id: 'viernes',
    short: 'V',
    label: 'Viernes',
    title: 'Full body metabólico',
    focus: 'Circuito + movilidad',
    accent: '#c084fc',
    exercises: [
      { id: 'prensa-unilateral', name: 'Prensa unilateral', kind: 'strength', target: '3 × 12 por pierna' },
      { id: 'remo-mancuerna-1-mano', name: 'Remo con mancuerna a 1 mano', kind: 'strength', target: '3 × 12 por lado' },
      { id: 'pec-deck-pecho', name: 'Pec Deck pecho', kind: 'strength', target: '3 × 12' },
      { id: 'zancadas', name: 'Zancadas', kind: 'strength', target: '3 × 10 por pierna' },
      { id: 'movilidad-toracica-cadera', name: 'Movilidad torácica / cadera', kind: 'timed', durationUnit: 'min', target: '10 min' },
      { id: 'cardio-final', name: 'Cardio final', kind: 'cardio', target: '15 min' },
    ],
  },
]

export const DAY_BY_ID = Object.fromEntries(ROUTINE.map((d) => [d.id, d])) as Record<DayId, DayTemplate>

export const EXERCISE_BY_ID: Record<string, ExerciseTemplate & { day: DayId }> = Object.fromEntries(
  ROUTINE.flatMap((d) => d.exercises.map((e) => [e.id, { ...e, day: d.id }])),
)
