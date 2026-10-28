// Genera las imágenes que faltan de un vídeo en <dir>/ (una por entrada de plan.imgs).
// Uso: node src/images.mjs content/videos/<id> <carpeta-imagenes> [máximo de imágenes en esta pasada]
// Proveedor: IMG_PROVIDER = cloudflare (por defecto si hay CF_API_TOKEN, gratis ~170/día) | gemini (de pago) | placeholder (pruebas)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse, fullPrompt } from './parse.mjs';

const [videoDir, outDir, maxArg] = process.argv.slice(2);
const plan = parse(path.resolve(videoDir));
// la miniatura va primero: es lo que más importa si el cupo del día no llega para todo
const meta = JSON.parse(fs.readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
if (meta.miniatura?.prompt) plan.imgs.unshift({ file: 'miniatura.jpg', shot: -1, prompt: fullPrompt(meta.miniatura.prompt), seed: 7 });
const max = Number(maxArg || Infinity);
fs.mkdirSync(outDir, { recursive: true });
const provider = process.env.IMG_PROVIDER || (process.env.CF_API_TOKEN ? 'cloudflare' : process.env.GEMINI_API_KEY ? 'gemini' : 'placeholder');
const CF_MODEL = process.env.CF_MODEL || '@cf/black-forest-labs/flux-1-schnell';
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-lite-image';

class Quota extends Error {}

async function cloudflare(img) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: img.prompt, steps: 8, seed: img.seed }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 429 || /neuron|limit|quota/i.test(JSON.stringify(j.errors || ''))) throw new Quota(JSON.stringify(j.errors || r.status));
  if (!r.ok || !j.result?.image) throw new Error(`Cloudflare ${r.status}: ${JSON.stringify(j.errors || j).slice(0, 300)}`);
  return Buffer.from(j.result.image, 'base64');
}

async function gemini(img) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: img.prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } } }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) throw new Quota(JSON.stringify(j.error || r.status));
  const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!r.ok || !part) throw new Error(`Gemini ${r.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`);
  return Buffer.from(part.inlineData.data, 'base64');
}

// fondo oscuro con el número de plano: sirve para probar la cadena sin gastar imágenes
function placeholder(img, file) {
  const hue = (img.shot * 37) % 360;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `gradients=s=1920x1080:c0=0x0b0b0b:c1=0x${hsl(hue)}:x0=0:y0=0:x1=1920:y1=1080:d=1`, '-frames:v', '1',
    '-vf', `noise=alls=12:allf=t,drawtext=text='plano ${img.shot}':fontcolor=0xd9b26f:fontsize=64:x=80:y=h-140`, '-q:v', '3', file]);
}
const hsl = h => { const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (0.18 - 0.12 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)].map(x => x.toString(16).padStart(2, '0')).join(''); };

// todas las imágenes, sea cual sea su tamaño de origen, se guardan a 1920x1080 (recorte centrado)
function normalize(buf, file) {
  const tmp = file + '.src';
  fs.writeFileSync(tmp, buf);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080', '-q:v', '2', file]);
  fs.rmSync(tmp);
}

let made = 0, missing = 0;
for (const img of plan.imgs) {
  const file = path.join(outDir, img.file);
  if (fs.existsSync(file)) continue;
  if (made >= max) { missing++; continue; }
  try {
    if (provider === 'placeholder') placeholder(img, file);
    else normalize(await (provider === 'gemini' ? gemini(img) : cloudflare(img)), file);
    made++;
    if (made % 10 === 0) console.log(`${made} imágenes nuevas`);
  } catch (e) {
    if (e instanceof Quota) { console.log(`::notice::cupo del día agotado tras ${made} imágenes (${e.message.slice(0, 120)})`); missing = plan.imgs.filter(i => !fs.existsSync(path.join(outDir, i.file))).length; break; }
    console.log(`::warning::${img.file}: ${e.message}`); missing++;
  }
}
const total = plan.imgs.length;
const have = plan.imgs.filter(i => fs.existsSync(path.join(outDir, i.file))).length;
console.log(`${plan.id}: ${made} nuevas con ${provider}, ${have}/${total} listas`);
fs.writeFileSync(path.join(outDir, 'estado.json'), JSON.stringify({ id: plan.id, provider, have, total, complete: have === total }, null, 1));
