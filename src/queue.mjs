// Imprime las filas del calendario que hay que renderizar ahora: las que se publican en los próximos 2 días (hora de Madrid)
// y aún no están hechas. Así el vídeo del domingo está listo el viernes, con margen para subirlo y revisarlo.
// Uso: node src/queue.mjs <estado.json> [YYYY-MM-DD,... para forzar esas fechas]
import fs from 'node:fs';

const [stateFile, force] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(new URL('../content/calendario.json', import.meta.url))).items;
const done = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const day = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
const want = force ? force.split(',').map(s => s.trim()) : [0, 1, 2].map(i => day(new Date(Date.now() + i * 864e5)));
console.log(JSON.stringify(rows.filter(r => want.includes(r.date) && (force || !done[r.date + '|' + r.video]))));
