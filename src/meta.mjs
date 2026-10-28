// Escribe la entrada de la cola que Make lee el día anterior a publicar: queue/<fecha>.json en GitHub Pages.
// Uso: node src/meta.mjs content/videos/<id> <out-dir del render> <fecha YYYY-MM-DD> <url base de los archivos> <salida.json>
import fs from 'node:fs';
import path from 'node:path';

const [videoDir, renderDir, date, base, out] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
const render = JSON.parse(fs.readFileSync(path.join(renderDir, 'render.json'), 'utf8'));
// 19:00 de Madrid del día de publicación, en UTC (cambia con el horario de verano)
function publishAt(d) {
  for (const off of ['+02:00', '+01:00']) {
    const t = new Date(`${d}T19:00:00${off}`);
    const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
    if (hm === '19:00') return t.toISOString().replace('.000Z', 'Z');
  }
}
const chapters = 'Capítulos\n' + render.chapters.map(c => `${c.at} ${c.title}`).join('\n');
const clean = s => String(s ?? '').replace(/[<>]/g, '');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  date, publish_at: publishAt(date), id: meta.id,
  title: clean(meta.titulo).slice(0, 100),
  description: clean(meta.descripcion.replace('{capitulos}', chapters)).slice(0, 4900),
  tags: meta.etiquetas || [],
  category: '27',
  video_url: `${base}/video.mp4`,
  thumb_url: `${base}/miniatura.jpg`,
  srt_url: `${base}/subtitulos.srt`,
  duration_min: +(render.duration / 60).toFixed(1),
  size_mb: render.size_mb,
}, null, 1));
console.log('cola', out, meta.titulo);
