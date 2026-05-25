/** datetime-local → ISO для Supabase */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
}

/** ISO → datetime-local (локальная зона браузера) */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
