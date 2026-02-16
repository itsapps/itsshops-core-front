import dayjs from 'dayjs';

export function toIsoString(text: string) {
  return dayjs(text).toISOString()
}