import type { BusinessSchedule } from '../db/schema';

export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
export const MAX_BOOKING_MONTHS_AHEAD = 24;

export function buildScheduleTimes(schedule: BusinessSchedule, date: string, durationMinutes: number) {
  if (!isBusinessDay(schedule, date)) return [];
  const first = timeToMinutes(schedule.startTime);
  const closing = timeToMinutes(schedule.endTime);
  const interval = schedule.slotIntervalMinutes;
  const times: string[] = [];
  for (let minute = first; minute + durationMinutes <= closing; minute += interval) times.push(minutesToTime(minute));
  return times;
}

export function isBusinessDay(schedule: BusinessSchedule, date: string) {
  return isValidIsoDate(date) && schedule.openDays.includes(weekday(date));
}

export function isPastScheduleTime(date: string, time: string) {
  const now = saoPauloNow();
  return date < now.date || (date === now.date && timeToMinutes(time) <= now.minutes);
}

export function todayInSaoPaulo() {
  return saoPauloNow().date;
}

export function maximumBookingDate(today = todayInSaoPaulo()) {
  if (!isValidIsoDate(today)) throw new Error('Data de referência inválida.');
  const [year, month, day] = today.split('-').map(Number);
  const targetMonthIndex = month - 1 + MAX_BOOKING_MONTHS_AHEAD;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function isBookableDate(value: string, today = todayInSaoPaulo()) {
  return isValidIsoDate(value) && value >= today && value <= maximumBookingDate(today);
}

export function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function timeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function saoPauloNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, minutes: Number(value('hour')) * 60 + Number(value('minute')) };
}
