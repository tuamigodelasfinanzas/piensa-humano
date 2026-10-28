// Imprime los vídeos del calendario que se publican en los próximos N días (por defecto 21) y que aún no tienen todas sus imágenes,
// del más cercano al más lejano. Sin calendario, devuelve el primer vídeo de content/videos (para el piloto).
import fs from 'node:fs';

const days = Number(process.argv[2] || 21);
const rows = JSON.parse(fs.readFileSync(new URL('../content/calendario.json', import.meta.url))).items;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const limit = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(Date.now() + days * 864e5));
let ids = rows.filter(r => r.date >= today && r.date <= limit).sort((a, b) => a.date.localeCompare(b.date)).map(r => r.video);
if (!rows.length) ids = fs.readdirSync(new URL('../content/videos', import.meta.url)).sort().slice(0, 1);
console.log([...new Set(ids)].join(' '));
