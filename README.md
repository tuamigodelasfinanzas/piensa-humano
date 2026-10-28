# HUMANO (@PiensaHumano)

Ensayos de filosofía en vídeo, de unos 30-35 minutos, generados y publicados de forma automática: imágenes con IA animadas, voz de Álvaro (edge-tts), música original, subtítulos y subida programada a YouTube con Make. Es el quinto canal del conjunto y reutiliza lo que ya funciona en los otros:

| Pieza | Viene de |
|---|---|
| Voz con edge-tts y mezclador con ducking (`src/voice.mjs`, `tools/mix.py`) | ZERO |
| Música original hecha con numpy (`tools/musica.py`) | ZERO (`tools/make_audio.py`) |
| Aviso por Telegram (secrets `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`, como en los otros canales) | ZERO |
| Release de GitHub con el vídeo y su ficha de publicación (los vídeos largos pasan de los 100 MB de Pages y de Make Core) | nuevo |
| Imágenes con IA (Cloudflare Workers AI, gratis) y animación con zoom y paneo en ffmpeg | nuevo |

## Cómo funciona

1. **Guion** en `content/videos/<id>/guion.md`: actos (`# Título`, son los capítulos de YouTube), planos (`> img: prompt | movimiento`) y la narración tal cual se locuta. El formato está explicado al principio del propio guion. `content/videos/<id>/video.json` lleva el título, la descripción, las etiquetas y la miniatura.
2. **Estilo** fijo del canal en `content/estilo.json`: voz, ritmo, prompt base de las imágenes y volumen de la música.
3. **Imágenes** (`.github/workflows/imagenes.yml`, cada día a las 05:00 UTC): genera las que faltan de los próximos vídeos, unas 160 al día, y las guarda en la release `img-<id>`. Cada plano largo se divide en varias imágenes, una cada ~10 segundos.
4. **Calendario** en `content/calendario.json`: una fila `{ "date": "2026-11-08", "video": "001-suficiente" }` por vídeo. Los vídeos largos salen los domingos a las 19:00 (Madrid).
5. **Publicar** (`.github/workflows/publicar.yml`, cada día a las 08:00 UTC): renderiza lo que se publica en los próximos 2 días (`src/render.mjs`), así que el vídeo del domingo está listo el viernes. Crea la release `v-<fecha>-<id>` con `video.mp4`, `miniatura.jpg`, `subtitulos.srt` y la **ficha de publicación** (`src/meta.mjs`: título, descripción con capítulos, etiquetas y los pasos) y avisa por Telegram.
6. **Subida a mano** a YouTube Studio siguiendo la ficha, programada para el domingo a las 19:00 (unos 5 minutos). Make Core no admite archivos de más de 100 MB y un vídeo de 30 minutos ocupa unos 250-300 MB; subir desde GitHub con la API de YouTube exige que Google verifique la app (si no, los vídeos quedan bloqueados en privado). El escenario de Make "HUMANO · Subir a YouTube programado" está creado pero apagado, por si algún día se usa con un plan mayor.

## Puesta en marcha (una vez)

En **Settings → Secrets and variables → Actions** de este repo:

- Secrets **`CF_ACCOUNT_ID`** y **`CF_API_TOKEN`**: cuenta gratuita de Cloudflare → *AI* → *Workers AI* → *Use REST API*: ahí está el Account ID y el botón para crear un token con permiso *Workers AI*.
- (Opcional) Secret **`GEMINI_API_KEY`** y variable **`IMG_PROVIDER = gemini`** si algún día se prefiere Gemini (de pago, ~0,02 € por imagen en lote).
- (Opcional) Secrets **`TELEGRAM_BOT_TOKEN`** y **`TELEGRAM_CHAT_ID`** para recibir el aviso de "listo para subir" (pueden ser los del centro de mando).
- (Opcional) Variable **`PH_MAXRATE`** (por ejemplo `900k`) para limitar el tamaño del vídeo.

## En local

```bash
npm install
node src/parse.mjs content/videos/001-suficiente                       # resumen: actos, planos, imágenes, duración estimada
IMG_PROVIDER=placeholder node src/images.mjs content/videos/001-suficiente out/001/img   # fondos de prueba en vez de imágenes
PH_VOICE=false PH_ONLY=0 node src/render.mjs content/videos/001-suficiente out/001/img out/prueba   # solo el acto 1, sin voz
node src/thumb.mjs content/videos/001-suficiente out/001/img out/prueba/miniatura.jpg
```

`PH_VOICE=false` renderiza sin voz (duraciones estimadas) cuando no hay acceso al servicio de voz. Desde **Actions → Publicar → Run workflow → preview** se puede renderizar cualquier vídeo como vista previa con voz (release `preview-<id>`).

## Estructura

```
content/estilo.json        voz, ritmo, prompt base, música
content/calendario.json    qué vídeo sale cada domingo
content/videos/<id>/       guion.md + video.json
src/                       parse, images, voice, render, thumb, meta (ficha), queue, upcoming
tools/                     mix.py (mezcla con ducking), musica.py (música original)
```
