// Escribe la ficha de publicación de un vídeo (ficha.md): lo que hay que pegar en YouTube Studio al subirlo a mano.
// Uso: node src/meta.mjs content/videos/<id> <out-dir del render> <fecha YYYY-MM-DD> <url de la release> <salida.md>
import fs from 'node:fs';
import path from 'node:path';

const [videoDir, renderDir, date, url, out] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(videoDir, 'video.json'), 'utf8'));
const render = JSON.parse(fs.readFileSync(path.join(renderDir, 'render.json'), 'utf8'));
const chapters = 'Capítulos\n' + render.chapters.map(c => `${c.at} ${c.title}`).join('\n');
const clean = s => String(s ?? '').replace(/[<>]/g, '');
const title = clean(meta.titulo).slice(0, 100);
const description = clean(meta.descripcion.replace('{capitulos}', chapters)).slice(0, 4900);
const day = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }).format(new Date(date + 'T12:00:00Z'));
fs.writeFileSync(out, `# ${title}

**Programar para:** ${day}, 19:00 (hora de Madrid) · **Duración:** ${(render.duration / 60).toFixed(1)} min · **Tamaño:** ${render.size_mb} MB

Archivos: [video.mp4](${url}/video.mp4) · [miniatura.jpg](${url}/miniatura.jpg) · [subtitulos.srt](${url}/subtitulos.srt)

## Cómo subirlo (5 minutos)
1. YouTube Studio → Crear → Subir vídeos → video.mp4.
2. Título y descripción: copia los de abajo. Miniatura: miniatura.jpg.
3. Más opciones → Contenido alterado o sintético: **Sí** (imágenes con IA). Etiquetas: las de abajo. Categoría: Educación.
4. Subtítulos → Subir archivo → Con sincronización → subtitulos.srt (español).
5. Visibilidad → Programar → ${day}, 19:00.

## Título
\`\`\`
${title}
\`\`\`

## Descripción
\`\`\`
${description}
\`\`\`

## Etiquetas
\`\`\`
${(meta.etiquetas || []).join(', ')}
\`\`\`
`);
console.log('ficha', out, title);
