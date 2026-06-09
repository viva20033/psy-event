/** Простой парсер CSV (запятая или точка с запятой, без кавычек с переносами). */
export function parseCsv(text: string): string[][] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const sep = trimmed.includes(';') && !trimmed.includes(',') ? ';' : ',';
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(sep).map((c) => c.trim()));
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
