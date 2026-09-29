/** Spanish labels for equipment slugs in the exercises dataset. */
export const EQUIPMENT_LABELS: Record<string, string> = {
  assisted: 'Asistido',
  band: 'Banda elástica',
  barbell: 'Barra',
  'body weight': 'Peso corporal',
  'bosu ball': 'Bosu',
  cable: 'Polea',
  dumbbell: 'Mancuerna',
  'elliptical machine': 'Elíptica',
  'ez barbell': 'Barra EZ',
  hammer: 'Martillo',
  kettlebell: 'Kettlebell',
  'leverage machine': 'Máquina',
  'medicine ball': 'Balón medicinal',
  'olympic barbell': 'Barra olímpica',
  'resistance band': 'Banda de resistencia',
  roller: 'Rodillo',
  rope: 'Cuerda',
  'skierg machine': 'SkiErg',
  'sled machine': 'Trineo',
  'smith machine': 'Smith',
  'stability ball': 'Fitball',
  'stationary bike': 'Bici estática',
  'stepmill machine': 'Stepmill',
  tire: 'Neumático',
  'trap bar': 'Barra hexagonal',
  'upper body ergometer': 'Ergómetro de brazos',
  weighted: 'Con lastre',
  'wheel roller': 'Rueda abdominal',
}

export function equipmentLabel(slug: string): string {
  return EQUIPMENT_LABELS[slug] ?? slug.replace(/\b\w/g, (c) => c.toUpperCase())
}
