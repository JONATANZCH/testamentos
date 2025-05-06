export function capitalizeFirstLetter(value: string): string {
  if (typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
