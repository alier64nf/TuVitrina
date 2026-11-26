export const TERMS_VERSION = '2026-11-v1';

export const STORE_RUBROS = [
  'Alimentos y bebidas',
  'Dulcería y panadería',
  'Ropa y calzado',
  'Belleza y cuidado personal',
  'Tecnología y accesorios',
  'Hogar y ferretería',
  'Artesanía y regalos',
  'Farmacia y salud',
  'Otro',
] as const;

export const CUBA_MUNICIPALITIES: Record<string, readonly string[]> = {
  'La Habana': [
    'Playa',
    'Plaza de la Revolución',
    'Centro Habana',
    'La Habana Vieja',
    'Regla',
    'La Habana del Este',
    'Guanabacoa',
    'San Miguel del Padrón',
    'Diez de Octubre',
    'Cerro',
    'Marianao',
    'La Lisa',
    'Boyeros',
    'Arroyo Naranjo',
    'Cotorro',
  ],
  'Pinar del Río': ['Pinar del Río', 'Consolación del Sur', 'Viñales', 'San Luis', 'Sandino'],
  Artemisa: ['Artemisa', 'Bauta', 'San Antonio de los Baños', 'Guanajay', 'Mariel', 'Güira de Melena'],
  Mayabeque: ['San José de las Lajas', 'Güines', 'Santa Cruz del Norte', 'Bejucal', 'Madruga'],
  Matanzas: ['Matanzas', 'Cárdenas', 'Varadero', 'Colón', 'Jovellanos', 'Jagüey Grande'],
  'Villa Clara': ['Santa Clara', 'Sagua la Grande', 'Placetas', 'Remedios', 'Caibarién', 'Camajuaní'],
  Cienfuegos: ['Cienfuegos', 'Palmira', 'Cumanayagua', 'Rodas', 'Cruces'],
  'Sancti Spíritus': ['Sancti Spíritus', 'Trinidad', 'Cabaiguán', 'Yaguajay', 'Jatibonico'],
  'Ciego de Ávila': ['Ciego de Ávila', 'Morón', 'Chambas', 'Ciro Redondo', 'Majagua'],
  Camagüey: ['Camagüey', 'Florida', 'Nuevitas', 'Guáimaro', 'Minas'],
  'Las Tunas': ['Las Tunas', 'Puerto Padre', 'Amancio', 'Colombia', 'Jobabo'],
  Holguín: ['Holguín', 'Banes', 'Gibara', 'Moa', 'Mayarí', 'Rafael Freyre'],
  Granma: ['Bayamo', 'Manzanillo', 'Jiguaní', 'Niquero', 'Bartolomé Masó'],
  'Santiago de Cuba': ['Santiago de Cuba', 'Palma Soriano', 'Contramaestre', 'San Luis', 'Songo-La Maya'],
  Guantánamo: ['Guantánamo', 'Baracoa', 'El Salvador', 'Maisí', 'Imías'],
  'Isla de la Juventud': ['Nueva Gerona'],
};

export const CUBA_PROVINCES = Object.keys(CUBA_MUNICIPALITIES);

export const WEEK_DAYS = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
] as const;

export type WeekDayKey = (typeof WEEK_DAYS)[number]['key'];

export interface DayHours {
  open: boolean;
  from: string;
  to: string;
}

export type WeeklyHours = Record<WeekDayKey, DayHours>;

export function createDefaultWeeklyHours(): WeeklyHours {
  return {
    mon: { open: true, from: '09:00', to: '18:00' },
    tue: { open: true, from: '09:00', to: '18:00' },
    wed: { open: true, from: '09:00', to: '18:00' },
    thu: { open: true, from: '09:00', to: '18:00' },
    fri: { open: true, from: '09:00', to: '18:00' },
    sat: { open: true, from: '09:00', to: '14:00' },
    sun: { open: false, from: '09:00', to: '13:00' },
  };
}

/**
 * Normaliza un número móvil cubano a formato E.164 (+535XXXXXXX).
 * Acepta "51234567", "051234567", "5351234567", "+53 5123 4567".
 */
export function normalizeCubanWhatsApp(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8 && digits.startsWith('5')) {
    return `+53${digits}`;
  }
  if (digits.length === 9 && digits.startsWith('05')) {
    return `+53${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith('535')) {
    return `+${digits}`;
  }
  return null;
}

export interface CategorySchedule {
  enabled: boolean;
  days: WeekDayKey[];
  from: string;
  to: string;
}

export function getCubaCurrentDayAndMinutes(now = new Date()): {
  dayKey: WeekDayKey;
  minutes: number;
} {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Havana',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const weekdayRaw = parts.find((p) => p.type === 'weekday')?.value.toLowerCase() ?? 'mon';
    const mapDay: Record<string, WeekDayKey> = {
      mon: 'mon',
      tue: 'tue',
      wed: 'wed',
      thu: 'thu',
      fri: 'fri',
      sat: 'sat',
      sun: 'sun',
    };
    const dayKey = mapDay[weekdayRaw.slice(0, 3)] ?? 'mon';
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? now.getHours()) % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? now.getMinutes());
    return { dayKey, minutes: hour * 60 + minute };
  } catch {
    const dayNames: WeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return {
      dayKey: dayNames[now.getDay()] ?? 'mon',
      minutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
}

export function isCategoryAvailableNow(
  schedule: CategorySchedule | null | undefined,
  now = new Date(),
): boolean {
  if (!schedule || !schedule.enabled) return true;
  const { dayKey, minutes } = getCubaCurrentDayAndMinutes(now);
  if (Array.isArray(schedule.days) && schedule.days.length > 0 && !schedule.days.includes(dayKey)) {
    return false;
  }
  const [fromH, fromM] = (schedule.from || '00:00').split(':').map(Number);
  const [toH, toM] = (schedule.to || '23:59').split(':').map(Number);
  const fromMin = (fromH ?? 0) * 60 + (fromM ?? 0);
  const toMin = (toH ?? 23) * 60 + (toM ?? 59);
  if (toMin < fromMin) {
    // Cruza medianoche (ej. 20:00 a 02:00)
    return minutes >= fromMin || minutes <= toMin;
  }
  return minutes >= fromMin && minutes <= toMin;
}

