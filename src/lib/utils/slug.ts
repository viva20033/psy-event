/** Простой slug для мест (латиница + цифры) */
export function slugify(text: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const lower = text.toLowerCase().trim();
  let out = '';
  for (const ch of lower) {
    out += map[ch] ?? ch;
  }
  out = out.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return out || `item-${Date.now()}`;
}
