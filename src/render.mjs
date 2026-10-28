// Renderiza un vídeo largo: guion + imágenes -> video.mp4 (1920x1080, H.264 + AAC), subtitulos.srt, render.json (tiempos y capítulos).
// Uso: node src/render.mjs content/videos/<id> <carpeta-imagenes> <carpeta-salida>
// Env: PH_VOICE=false sin voz (duraciones estimadas) · PH_FPS (25) · PH_CRF (23) · PH_MAXRATE (p. ej. 1500k, para limitar el tamaño) · PH_ONLY=2 solo ese acto
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse, shotImages, ESTILO, ROOT } from './parse.mjs';
import { tts, silent, voiceOn } from './voice.mjs';

const [videoDir, imgDir, outDir] = process.argv.slice(2).map(p => path.resolve(p));
const plan = parse(videoDir);
const FPS = Number(process.env.PH_FPS || 25);
const XF = 0.8;          // fundido entre imágenes
const ACT_GAP = 1.2;     // silencio entre actos (fundido a negro)
const work = path.join(outDir, 'work');
fs.mkdirSync(work, { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 26 });
const acts = process.env.PH_ONLY ? [plan.acts[Number(process.env.PH_ONLY)]] : plan.acts;

// 1) voz y tiempos: cada párrafo es un clip; cada plano dura lo que duran sus párrafos
let useVoice = voiceOn();
const clips = [], cues = [], chapters = [];
let t = 0.8;
for (const [ai, act] of acts.entries()) {
  if (ai > 0) t += ACT_GAP;
  act.start = t;
  chapters.push({ at: ai === 0 ? 0 : t, title: act.title });
  for (const s of act.shots) {
    s.start = t;
    for (const [pi, p] of s.parts.entries()) {
      if (p.pause) { t += p.pause; continue; }
      let r;
      if (useVoice) {
        const f = path.join(work, `v${String(s.n).padStart(3, '0')}-${pi}.mp3`);
        try { r = tts(p.text, f); clips.push({ file: f, at: t }); }
        catch (e) { console.log('::warning::la voz falló, sigo sin voz: ' + e.message); useVoice = false; clips.length = 0; }
      }
      if (!r) r = silent(p.text);
      for (const c of r.cues) cues.push({ start: t + c.start, end: t + c.end, text: c.text });
      t += r.dur + ESTILO.hueco_parrafo;
    }
    s.end = t;
  }
  act.end = t + 0.4;
  t = act.end;
}
const total = t + 1.0;
console.log(`${plan.id}: ${(total / 60).toFixed(1)} min, ${clips.length} clips de voz${useVoice ? '' : ' (sin voz)'}`);

// 2) imágenes por plano: el plano se reparte entre sus imágenes (como mínimo 5 s cada una)
const MOVES = { in: 1, out: 1, left: 1, right: 1, up: 1, down: 1 };
const nextMove = m => ({ in: 'left', left: 'out', out: 'right', right: 'in', up: 'out', down: 'in' })[m] || 'in';
function zoompan(move, frames) {
  const p = `(on/${Math.max(1, frames - 1)})`;
  const ease = `(0.5-0.5*cos(PI*${p}))`;
  const cx = 'iw/2-(iw/zoom/2)', cy = 'ih/2-(ih/zoom/2)';
  const z = { in: `1+0.12*${ease}`, out: `1.12-0.12*${ease}` }[move] || '1.12';
  const x = { left: `(iw-iw/zoom)*(1-${ease})`, right: `(iw-iw/zoom)*${ease}` }[move] || cx;
  const y = { up: `(ih-ih/zoom)*(1-${ease})`, down: `(ih-ih/zoom)*${ease}` }[move] || cy;
  return `zoompan=z='${z}':x='${x}':y='${y}':d=${frames}:s=1920x1080:fps=${FPS}`;
}

// 3) un archivo de vídeo por acto, con fundidos entre imágenes y a negro al principio y al final
const actFiles = [];
for (const [ai, act] of acts.entries()) {
  const segs = [];
  for (const s of act.shots) {
    const imgs = shotImages(plan, s).map(f => path.join(imgDir, f)).filter(f => fs.existsSync(f));
    if (!imgs.length) throw new Error(`Faltan las imágenes del plano ${s.n} (${shotImages(plan, s).join(', ')}) en ${imgDir}`);
    const dur = s.end - s.start;
    const k = Math.max(1, Math.min(imgs.length, Math.floor(dur / 5)));
    let move = s.move;
    for (let i = 0; i < k; i++) { segs.push({ img: imgs[i], dur: dur / k, move }); move = nextMove(move); }
  }
  // el primero empieza en el inicio del acto y el último llega hasta su final
  segs[0].dur += act.shots[0].start - act.start;
  segs.at(-1).dur += act.end - act.shots.at(-1).end;
  const inputs = [], filters = [];
  segs.forEach((g, i) => {
    const len = g.dur + (i < segs.length - 1 ? XF : 0);
    inputs.push('-i', g.img);
    filters.push(`[${i}:v]scale=3840:2160:flags=lanczos,${zoompan(g.move, Math.ceil(len * FPS))},setsar=1,format=yuv420p[s${i}]`);
    g.len = len;
  });
  let last = 's0', acc = segs[0].len;
  for (let i = 1; i < segs.length; i++) {
    filters.push(`[${last}][s${i}]xfade=transition=fade:duration=${XF}:offset=${(acc - XF).toFixed(3)}[x${i}]`);
    last = `x${i}`; acc += segs[i].len - XF;
  }
  const actDur = act.end - act.start + (ai === acts.length - 1 ? 1.0 : 0);
  const lead = ai === 0 ? act.start : 0;   // el primer acto empieza en negro
  filters.push(`[${last}]trim=duration=${actDur.toFixed(3)},${lead ? `tpad=start_duration=${lead.toFixed(3)}:color=black,` : ''}fade=t=in:st=0:d=0.8,fade=t=out:st=${(actDur + lead - 0.8).toFixed(3)}:d=0.8,format=yuv420p[v]`);
  const gap = ai < acts.length - 1 ? ACT_GAP : 0;
  if (gap) { filters[filters.length - 1] = filters.at(-1).replace('format=yuv420p[v]', `tpad=stop_duration=${gap}:color=black,format=yuv420p[v]`); }
  const file = path.join(work, `acto-${ai}.mp4`);
  const rate = process.env.PH_MAXRATE ? ['-maxrate', process.env.PH_MAXRATE, '-bufsize', String(parseInt(process.env.PH_MAXRATE) * 2) + 'k'] : [];
  fs.writeFileSync(file + '.filter', filters.join(';\n'));
  console.log(`acto ${ai + 1}/${acts.length} "${act.title}": ${segs.length} imágenes, ${(actDur + lead + gap).toFixed(1)} s`);
  ff([...inputs, '-filter_complex_script', file + '.filter', '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-preset', process.env.PH_PRESET || 'medium', '-crf', process.env.PH_CRF || '23', '-tune', 'film', ...rate, '-pix_fmt', 'yuv420p', '-g', String(FPS * 4), file]);
  actFiles.push(file);
}
const list = path.join(work, 'actos.txt');
fs.writeFileSync(list, actFiles.map(f => `file '${f}'`).join('\n'));
const silentVideo = path.join(work, 'imagen.mp4');
ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silentVideo]);

// 4) sonido: voz + música de fondo que baja cuando habla el narrador
const music = path.join(ROOT, ESTILO.musica);
if (!fs.existsSync(music)) execFileSync('python3', [path.join(ROOT, 'tools/musica.py')], { cwd: ROOT, stdio: 'inherit' });
const mixPlan = path.join(work, 'mix.json'), wav = path.join(work, 'mix.wav');
fs.writeFileSync(mixPlan, JSON.stringify({ total, clips, sfx: [], music, musicGain: ESTILO.volumen_musica }));
execFileSync('python3', [path.join(ROOT, 'tools/mix.py'), mixPlan, wav], { stdio: 'inherit' });
const video = path.join(outDir, 'video.mp4');
ff(['-i', silentVideo, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', video]);

// 5) subtítulos y capítulos
const stamp = s => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
fs.writeFileSync(path.join(outDir, 'subtitulos.srt'), cues.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const size = fs.statSync(video).size;
fs.writeFileSync(path.join(outDir, 'render.json'), JSON.stringify({
  id: plan.id, duration: total, voice: useVoice, size_mb: +(size / 1e6).toFixed(1),
  chapters: chapters.map(c => ({ at: mmss(c.at), title: c.title })),
}, null, 1));
console.log(`listo: ${video} (${(size / 1e6).toFixed(1)} MB, ${(total / 60).toFixed(1)} min)`);
