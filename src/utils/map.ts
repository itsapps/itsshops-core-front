export function map(arr: any, key: string) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => item?.[key]);
}