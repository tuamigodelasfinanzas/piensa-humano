// Miniatura 1280x720 con el estilo fijo del canal (content/estilo.json → miniatura).
// Regla de tercios: la escena ocupa dos tercios y en el tercio libre van 2-3 palabras grandes, siempre con la misma fuente y tamaño:
// líneas alternas amarillo/blanco con contorno negro, trazo rojo bajo la primera línea y la firma HUMANO debajo.
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
const fs_ = f => path.join(ROOT, 'node_modules/@fontsource', f);
const font = fs_('anton/files/anton-latin-400-normal.woff'), firmaFont = fs_('cinzel/files/cinzel-latin-700-normal.woff');
const trazo = path.join(ROOT, 'assets/miniatura/trazo.png');

const m = meta.miniatura || {};
const lines = (Array.isArray(m.texto) ? m.texto : [m.texto]).filter(Boolean).map(l => String(l).toUpperCase());
const nWords = lines.join(' ').split(/\s+/).length;
if (nWords < 2 || nWords > S.max_palabras) throw new Error(`La miniatura lleva 2-${S.max_palabras} palabras: ${lines.join(' / ')}`);
const right = m.lado === 'derecha';
const W = 1280, H = 720, size = S.tamano, lh = Math.round(size * S.interlineado);
const colW = S.ancho_columna, colX = right ? W - S.margen - colW : S.margen;

// bloque centrado en vertical: líneas + firma
const firmaGap = 22, firmaSize = S.firma_tamano;
const blockH = lines.length * lh + firmaGap + firmaSize;
const top = Math.round((H - blockH) / 2);

// oscurece suavemente el tercio del texto para que se lea sobre cualquier escena
const ramp = right ? `(W-X)/(W*0.45)` : `X/(W*0.45)`;
const f = `(${1 - S.oscurecer}+${S.oscurecer}*min(1,${ramp}))`;
const chain = [`[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H},eq=contrast=1.1:saturation=1.15,` +
  `geq=r='r(X,Y)*${f}':g='g(X,Y)*${f}':b='b(X,Y)*${f}'[bg]`];
const tmp = [];
const text = (s, file, sz, color, y, extra) => {
  const tf = `${out}.${tmp.length}.txt`;
  fs.writeFileSync(tf, s);
  tmp.push(tf);
  return `drawtext=fontfile='${file}':textfile='${tf}':fontsize=${sz}:fontcolor=0x${color.slice(1)}:x=${colX}+(${colW}-tw)/2:y=${y}:${extra}`;
};
const draws = lines.map((l, i) => text(l, font, size, S.colores[i % S.colores.length], top + i * lh,
  `borderw=${S.contorno}:bordercolor=black:shadowcolor=black@0.7:shadowx=6:shadowy=6`));
draws.push(text(S.firma.split('').join(' '), firmaFont, firmaSize, S.firma_color, top + lines.length * lh + firmaGap, 'borderw=2:bordercolor=black@0.8'));
// la primera línea, encima el trazo rojo pegado a su base, y después el resto
const trazoY = top + Math.round(size * 0.92);
chain.push(`[bg]${draws[0]}[b0]`, `[1:v]scale=${Math.round(colW * 0.86)}:${Math.round(size * 0.2)}[tr]`,
  `[b0][tr]overlay=x=${colX + Math.round(colW * 0.07)}:y=${trazoY}[b1]`, `[b1]${draws.slice(1).join(',')}[out]`);

execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-i', trazo, '-filter_complex', chain.join(';'), '-map', '[out]', '-q:v', '2', out]);
tmp.forEach(t => fs.rmSync(t));
console.log('miniatura', out, fs.statSync(out).size, 'bytes');
