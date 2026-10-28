# HUMANO (@PiensaHumano)

Ensayos de filosofía en vídeo, de unos 30-35 minutos, generados y publicados de forma automática: imágenes con IA animadas, voz de Álvaro (edge-tts), música original, subtítulos y subida programada a YouTube con Make. Es el quinto canal del conjunto y reutiliza lo que ya funciona en los otros:

| Pieza | Viene de |
|---|---|
| Voz con edge-tts y mezclador con ducking (`src/voice.mjs`, `tools/mix.py`) | ZERO |
| Música original hecha con numpy (`tools/musica.py`) | ZERO (`tools/make_audio.py`) |
| Cola `queue/<fecha>.json` en GitHub Pages + Make que sube en privado y programa la publicación | ZERO |
| Release de GitHub para el vídeo (los vídeos largos pasan de los 100 MB que admite Pages) | nuevo |
| Imágenes con IA (Cloudflare Workers AI, gratis) y animación con zoom y paneo en ffmpeg | nuevo |

## Cómo funciona

1. **Guion** en `content/videos/<id>/guion.md`: actos (`# Título`, son los capítulos de YouTube), planos (`> img: prompt | movimiento`) y la narración tal cual se locuta. El formato está explicado al principio del propio guion. `content/videos/<id>/video.json` lleva el título, la descripción, las etiquetas y la miniatura.
2. **Estilo** fijo del canal en `content/estilo.json`: voz, ritmo, prompt base de las imágenes y volumen de la música.
3. **Imágenes** (`.github/workflows/imagenes.yml`, cada día a las 05:00 UTC): genera las que faltan de los próximos vídeos, unas 160 al día, y las guarda en la release `img-<id>`. Cada plano largo se divide en varias imágenes, una cada ~10 segundos.
4. **Calendario** en `content/calendario.json`: una fila `{ "date": "2026-11-08", "video": "001-suficiente" }` por vídeo. Los vídeos largos salen los domingos a las 19:00 (Madrid).
5. **Publicar** (`.github/workflows/publicar.yml`, cada día a las 08:00 UTC): renderiza lo que se publica hoy o mañana (`src/render.mjs`), sube `video.mp4`, `miniatura.jpg` y `subtitulos.srt` a la release `v-<fecha>-<id>` y escribe `queue/<fecha>.json` en GitHub Pages. **No publica nada** hasta que la variable `PUBLICAR` sea `si`.
6. **Make** ("HUMANO · Subir a YouTube programado") a las 17:00 (Madrid) lee `queue/<mañana>.json`, descarga el vídeo y lo sube a YouTube en privado, programado para las 19:00 del día siguiente, con su miniatura. Quedan unas 26 horas para revisarlo en YouTube Studio.

## Puesta en marcha (una vez)

En **Settings → Secrets and variables → Actions** de este repo:

- Secrets **`CF_ACCOUNT_ID`** y **`CF_API_TOKEN`**: cuenta gratuita de Cloudflare → *AI* → *Workers AI* → *Use REST API*: ahí está el Account ID y el botón para crear un token con permiso *Workers AI*.
- (Opcional) Secret **`GEMINI_API_KEY`** y variable **`IMG_PROVIDER = gemini`** si algún día se prefiere Gemini (de pago, ~0,02 € por imagen en lote).
- Variable **`PUBLICAR = si`** cuando el primer vídeo esté aprobado.
- (Opcional) Variable **`PH_MAXRATE`** (por ejemplo `900k`) para limitar el tamaño del vídeo si el plan de Make no admite archivos grandes (Core: 100 MB, Pro: 250 MB).

## En local

```bash
npm install
node src/parse.mjs content/videos/001-suficiente                       # resumen: actos, planos, imágenes, duración estimada
IMG_PROVIDER=placeholder node src/images.mjs content/videos/001-suficiente out/001/img   # fondos de prueba en vez de imágenes
PH_VOICE=false PH_ONLY=0 node src/render.mjs content/videos/001-suficiente out/001/img out/prueba   # solo el acto 1, sin voz
node src/thumb.mjs content/videos/001-suficiente out/001/img out/prueba/miniatura.jpg
```

`PH_VOICE=false` renderiza sin voz (duraciones estimadas) cuando no hay acceso al servicio de voz. Desde **Actions → Publicar → Run workflow → preview** se puede renderizar cualquier vídeo como vista previa descargable, con voz, sin publicar nada.

## Estructura

```
content/estilo.json        voz, ritmo, prompt base, música
content/calendario.json    qué vídeo sale cada domingo
content/videos/<id>/       guion.md + video.json
src/                       parse, images, voice, render, thumb, meta, queue, upcoming
tools/                     mix.py (mezcla con ducking), musica.py (música original)
```
