// Miniatura 1280x720: la imagen generada (miniatura.jpg) con el texto corto de video.json encima, en Oswald y color ocre.
// Uso: node src/thumb.mjs content/videos/<id> <carpeta-imagenes> <salida.jpg>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './parse.mjs';

const [videoDir, imgDir, out] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
const src = path.join(imgDir, 'miniatura.jpg');
if (!fs.existsSync(src)) throw new Error('Falta ' + src);
const font = path.join(ROOT, 'node_modules/@fontsource/oswald/files/oswald-latin-700-normal.woff');
const text = String(meta.miniatura?.texto || '').toUpperCase();
const tf = out + '.txt';
fs.writeFileSync(tf, text);
const vf = ['scale=1280:720', 'eq=contrast=1.08:saturation=0.9',
  'drawbox=x=0:y=ih*0.6:w=iw:h=ih*0.4:color=black@0.4:t=fill',
  text ? `drawtext=fontfile='${font}':textfile='${tf}':fontsize=118:fontcolor=0xE8B25A:x=56:y=h-th-64:shadowcolor=black@0.8:shadowx=4:shadowy=4` : null].filter(Boolean).join(',');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-vf', vf, '-q:v', '2', out]);
fs.rmSync(tf);
console.log('miniatura', out, fs.statSync(out).size, 'bytes');
