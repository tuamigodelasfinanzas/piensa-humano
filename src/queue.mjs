// Imprime las filas del calendario que hay que renderizar ahora: las que se publican hoy o mañana (hora de Madrid) y aún no están hechas.
// Uso: node src/queue.mjs <site/state/rendered.json> [YYYY-MM-DD,... para forzar esas fechas]
import fs from 'node:fs';

const [stateFile, force] = process.argv.slice(2);
const rows = JSON.parse(fs.readFileSync(new URL('../content/calendario.json', import.meta.url))).items;
const done = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const day = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d);
const want = force ? force.split(',').map(s => s.trim()) : [day(new Date()), day(new Date(Date.now() + 864e5))];
console.log(JSON.stringify(rows.filter(r => want.includes(r.date) && (force || !done[r.date + '|' + r.video]))));
