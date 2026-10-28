// Miniatura 1280x720 con el estilo fijo del canal (content/estilo.json → miniatura).
// Regla de tercios: la escena ocupa dos tercios y en el tercio libre van 2-3 palabras grandes, siempre con la misma fuente y tamaño:
// Montserrat 900; las líneas van en blanco con contorno negro y la última, en negro sobre un bloque naranja. Debajo, la firma HUMANO.
// video.json → miniatura: { prompt, texto: ["LÍNEA 1", "LÍNEA 2"], lado: "izquierda" | "derecha" }   (lado = dónde va el texto)
// Uso: node src/thumb.mjs content/videos/<id> <carpeta-imagenes> <salida.jpg>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './parse.mjs';

const [videoDir, imgDir, out] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/estilo.json'), 'utf8')).miniatura;
// una imagen base elegida a mano (content/videos/<id>/miniatura.jpg) tiene prioridad sobre la generada
const src = [path.join(videoDir, 'miniatura.jpg'), path.join(imgDir, 'miniatura.jpg')].find(f => fs.existsSync(f));
if (!src) throw new Error('Falta miniatura.jpg en ' + videoDir + ' o ' + imgDir);
const font = path.join(ROOT, 'node_modules/@fontsource/montserrat/files/montserrat-latin-900-normal.woff');

const m = meta.miniatura || {};
const lines = (Array.isArray(m.texto) ? m.texto : [m.texto]).filter(Boolean).map(l => String(l).toUpperCase());
const nWords = lines.join(' ').split(/\s+/).length;
if (nWords < 2 || nWords > S.max_palabras) throw new Error(`La miniatura lleva 2-${S.max_palabras} palabras: ${lines.join(' / ')}`);
const right = m.lado === 'derecha';
const W = 1280, H = 720, size = S.tamano, lh = Math.round(size * S.interlineado), pad = S.bloque_margen;
const colW = S.ancho_columna, colX = right ? W - S.margen - colW : S.margen;

// bloque centrado en vertical: líneas + firma
const firmaGap = 26, firmaSize = S.firma_tamano;
const top = Math.round((H - (lines.length * lh + pad + firmaGap + firmaSize)) / 2);

// oscurece suavemente el tercio del texto para que se lea sobre cualquier escena
const ramp = right ? `(W-X)/(W*0.45)` : `X/(W*0.45)`;
const f = `(${1 - S.oscurecer}+${S.oscurecer}*min(1,${ramp}))`;
const vf = [`scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},eq=contrast=1.08:saturation=1.1`,
  `geq=r='r(X,Y)*${f}':g='g(X,Y)*${f}':b='b(X,Y)*${f}'`];

const tmp = [];
const text = (s, sz, color, y, extra) => {
  const tf = `${out}.${tmp.length}.txt`;
  fs.writeFileSync(tf, s);
  tmp.push(tf);
  const x = right ? `${colX + colW}-tw` : `${colX}`;  // alineado al borde exterior
  return `drawtext=fontfile='${font}':textfile='${tf}':fontsize=${sz}:fontcolor=0x${color.slice(1)}:x=${x}:y=${y}:${extra}`;
};
lines.forEach((l, i) => {
  const last = i === lines.length - 1;
  const y = top + i * lh + (last ? pad : 0);
  vf.push(last
    ? text(l, size, S.color_bloque_texto, y, `box=1:boxcolor=0x${S.color_bloque.slice(1)}:boxborderw=${pad}`)
    : text(l, size, S.color, y, `borderw=${S.contorno}:bordercolor=black:shadowcolor=black@0.85:shadowx=0:shadowy=8`));
});
const yFirma = top + lines.length * lh + pad + firmaGap;
vf.push(text(S.firma.split('').join(' '), firmaSize, S.color, yFirma, 'shadowcolor=black@0.8:shadowx=0:shadowy=3'));

execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf.join(','), '-q:v', '2', out]);
tmp.forEach(t => fs.rmSync(t));
console.log('miniatura', out, fs.statSync(out).size, 'bytes');
