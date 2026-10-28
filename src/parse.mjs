// Lee un guion (content/videos/<id>/guion.md) y devuelve el plan del vídeo: actos, planos y párrafos.
// Uso como script: node src/parse.mjs content/videos/001-suficiente  -> imprime un resumen y las imágenes que hacen falta
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
export const ESTILO = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/estilo.json'), 'utf8'));
const MOVES = ['in', 'right', 'out', 'left', 'in', 'up', 'out', 'down'];

export const words = t => String(t).split(/\s+/).filter(Boolean).length;
export const estimate = t => words(t) / ESTILO.palabras_por_segundo;

// Estilo de cada imagen según lo que pide el prompt
export function fullPrompt(prompt, variant = '') {
  const p = [prompt, variant].filter(Boolean).join(', ');
  if (/engraving|daguerreotype/i.test(p)) return `${p}, ${ESTILO.prompt_grabado}`;
  if (/oil portrait|black and white|baroque|bust|manuscript|antique .*map|pastel style/i.test(p)) return `${p}, museum quality reproduction, aged texture, no text, no watermark`;
  return `${p}, ${ESTILO.prompt_base}`;
}

export function parse(dir) {
  const src = fs.readFileSync(path.join(dir, 'guion.md'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const front = {};
  const body = src.replace(/^---\n([\s\S]*?)\n---\n/, (_, f) => {
    for (const l of f.split('\n')) { const m = l.match(/^(\w+):\s*(.*)$/); if (m) front[m[1]] = m[2].trim(); }
    return '';
  });
  const acts = [], shots = [], named = {};
  let act = null, shot = null, n = 0;
  for (const raw of body.split(/\n\s*\n/)) {
    const block = raw.trim();
    if (!block) continue;
    let m;
    if ((m = block.match(/^#\s+(.+)$/))) { act = { title: m[1].trim(), shots: [] }; acts.push(act); continue; }
    if ((m = block.match(/^>\s*img(?:\s*#(\w+))?\s*:\s*(.+)$/))) {
      if (!act) throw new Error('Plano antes del primer acto: ' + block);
      const [desc, move] = m[2].split('|').map(s => s.trim());
      const ref = desc.startsWith('=') ? desc.slice(1) : null;
      if (ref && !named[ref]) throw new Error(`El plano "=${ref}" no existe (todavía) en el guion`);
      shot = { n: n++, key: m[1] || null, ref, prompt: ref ? named[ref].prompt : desc, move: MOVES.includes(move) ? move : MOVES[n % MOVES.length], parts: [] };
      if (m[1]) named[m[1]] = shot;
      shots.push(shot); act.shots.push(shot);
      continue;
    }
    if (!shot) throw new Error('Texto antes del primer plano: ' + block.slice(0, 60));
    if (/^\[PAUSA\]$/i.test(block)) { shot.parts.push({ pause: ESTILO.pausa }); continue; }
    shot.parts.push({ text: block.replace(/\s*\n\s*/g, ' ').replace(/[*_]/g, '') });
  }
  // cuántas imágenes necesita cada plano: una cada ~segundos_por_imagen; un plano repetido reutiliza las del original
  for (const s of shots) {
    s.est = s.parts.reduce((a, p) => a + (p.pause ?? estimate(p.text) + ESTILO.hueco_parrafo), 0);
    s.images = s.ref ? 0 : Math.max(1, Math.round(s.est / ESTILO.segundos_por_imagen));
  }
  const imgs = [];
  for (const s of shots) for (let v = 0; v < s.images; v++)
    imgs.push({ file: `p${String(s.n).padStart(3, '0')}-${v}.jpg`, shot: s.n, prompt: fullPrompt(s.prompt, ESTILO.variantes[v % ESTILO.variantes.length]), seed: 1000 * s.n + v });
  return { id: front.id || path.basename(dir), front, acts, shots, imgs, named };
}

// las imágenes de un plano (los repetidos apuntan a las del original)
export function shotImages(plan, s) {
  const src = s.ref ? plan.named[s.ref] : s;
  return plan.imgs.filter(i => i.shot === src.n).map(i => i.file);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const plan = parse(path.resolve(process.argv[2]));
  const est = plan.shots.reduce((a, s) => a + s.est, 0);
  const w = plan.shots.flatMap(s => s.parts).reduce((a, p) => a + (p.text ? words(p.text) : 0), 0);
  console.log(`${plan.id}: ${plan.acts.length} actos, ${plan.shots.length} planos, ${plan.imgs.length} imágenes, ${w} palabras, ~${(est / 60).toFixed(1)} min`);
  for (const a of plan.acts) console.log(`  ${a.title}: ${a.shots.length} planos, ~${(a.shots.reduce((x, s) => x + s.est, 0) / 60).toFixed(1)} min`);
}
