// Voz del narrador con edge-tts (gratis): es-ES-AlvaroNeural, la misma en todos los vídeos.
// PH_VOICE=false renderiza sin voz (duraciones estimadas), para previsualizar sin conexión al servicio.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ESTILO, estimate } from './parse.mjs';

export const voiceOn = () => String(process.env.PH_VOICE ?? 'true') !== 'false';
export const probe = f => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

// números y signos que la voz lee mal
const clean = t => String(t).replace(/(\d)\s?%/g, '$1 por ciento').replace(/§/g, 'párrafo ').replace(/\.\.\./g, '…').replace(/\s+/g, ' ').trim();

// Devuelve { dur, cues: [{start, end, text}] } con tiempos relativos al clip
export function tts(text, file) {
  const v = ESTILO.voz, tf = file + '.txt', sub = file + '.srt';
  fs.writeFileSync(tf, clean(text));
  let err = '';
  for (let i = 0; i < 4; i++) {
    try {
      fs.rmSync(file, { force: true });
      execFileSync('edge-tts', ['--voice', v.voice, `--rate=${v.rate}`, `--pitch=${v.pitch}`, '--file', tf, '--write-media', file, '--write-subtitles', sub], { stdio: 'pipe' });
      if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
        const dur = probe(file);
        return { dur, cues: fs.existsSync(sub) ? readSrt(fs.readFileSync(sub, 'utf8')) : split(text, dur) };
      }
    } catch (e) { err = String(e.stderr || e.message).slice(-200); }
  }
  throw new Error('edge-tts falló: ' + err);
}

// sin voz: duración estimada y subtítulos repartidos por longitud
export function silent(text) {
  const dur = estimate(text);
  return { dur, cues: split(text, dur) };
}

const ts = s => { const [h, m, r] = s.split(':'); const [sec, ms] = r.split(/[,.]/); return 3600 * h + 60 * m + Number(sec) + Number(ms) / 1000; };
export function readSrt(srt) {
  return srt.trim().split(/\n\s*\n/).map(b => {
    const l = b.split('\n'); const m = (l[1] || '').match(/(\S+)\s+-->\s+(\S+)/);
    return m && { start: ts(m[1]), end: ts(m[2]), text: l.slice(2).join(' ').trim() };
  }).filter(Boolean);
}

// trozos de como mucho ~42 caracteres por línea y dos líneas, repartidos en el tiempo según su longitud
export function split(text, dur) {
  const parts = [];
  for (const sentence of clean(text).match(/[^.!?…]+[.!?…]*["»”]?\s*/g) || [text]) {
    let cur = '';
    for (const w of sentence.trim().split(/\s+/)) {
      if ((cur + ' ' + w).trim().length > 84 && cur) { parts.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
    }
    if (cur) parts.push(cur);
  }
  const total = parts.reduce((a, p) => a + p.length, 0) || 1;
  let t = 0;
  return parts.map(p => { const d = dur * p.length / total; const c = { start: t, end: t + d, text: p }; t += d; return c; });
}
