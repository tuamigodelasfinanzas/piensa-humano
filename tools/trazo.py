# Dibuja el trazo rojo de pincel que va entre las líneas de la miniatura (assets/miniatura/trazo.png). Se ejecuta una sola vez.
import math, random
from PIL import Image, ImageDraw, ImageFilter
W, H, S = 520, 40, 4
random.seed(3)
img = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
for i in range(W * S):
    t = i / (W * S)
    th = (0.25 + 0.75 * math.sin(math.pi * min(1, t * 1.15)) ** 0.35) * 22 * S  # se afila hacia los extremos
    y = H * S / 2 + math.sin(t * 2.2) * 3 * S - t * 4 * S
    d.line([(i, y - th / 2 + random.uniform(-1, 1) * S), (i, y + th / 2 + random.uniform(-1, 1) * S)], fill=(214, 20, 26, 255))
img = img.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.4))
img.save('assets/miniatura/trazo.png')
