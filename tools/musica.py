"""Música de fondo original del canal (sin derechos de autor, hecha desde cero con numpy).
Uso: python3 tools/musica.py  -> assets/music/fondo.wav (unos 3 minutos, en bucle perfecto)
Un colchón ambiental lento y oscuro: acordes menores que cambian cada 15 s, ruido filtrado y notas sueltas de piano."""
import os, wave
import numpy as np

SR = 48000
DUR = 180.0
rng = np.random.default_rng(11)
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
t = np.arange(int(DUR * SR)) / SR

# La menor - Fa - Do - Mi menor - Re menor - La menor..., cada uno 15 s con fundido suave
CHORDS = [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [40, 52, 55, 59], [38, 50, 53, 57], [45, 57, 60, 64],
          [41, 53, 57, 65], [43, 55, 59, 62], [45, 57, 60, 64], [40, 52, 55, 59], [41, 53, 57, 60], [45, 52, 57, 60]]
SEG = DUR / len(CHORDS)


def pad(notes):
    x = np.zeros_like(t)
    for i, m in enumerate(notes):
        for det in (-0.12, 0.0, 0.09):
            f = hz(m + det)
            x += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * (0.6 if i == 0 else 0.35)
    return x


mix = np.zeros_like(t)
for k, ch in enumerate(CHORDS):
    w = np.exp(-0.5 * ((((t - (k + 0.5) * SEG) + DUR / 2) % DUR - DUR / 2) / (SEG * 0.55)) ** 2)  # ventana circular: el bucle no se nota
    mix += pad(ch) * w
mix *= 0.7 + 0.3 * np.sin(2 * np.pi * t / 9.0)  # respiración lenta

# ruido de viento filtrado
n = rng.standard_normal(len(t))
k = 400
wind = np.convolve(n, np.ones(k) / k, mode='same') * 6
wind *= 0.5 + 0.5 * np.sin(2 * np.pi * t / 23.0 + 1)
mix += wind * 0.25

# notas sueltas de piano, muy espaciadas
for at in np.arange(4.0, DUR - 6, 7.5):
    ch = CHORDS[int(at // SEG) % len(CHORDS)]
    m = rng.choice(ch) + 12 * rng.integers(1, 3)
    i0 = int(at * SR); L = int(5 * SR)
    tt = np.arange(L) / SR
    note = (np.sin(2 * np.pi * hz(m) * tt) + 0.3 * np.sin(4 * np.pi * hz(m) * tt)) * np.exp(-1.6 * tt) * (1 - np.exp(-60 * tt))
    mix[i0:i0 + L] += note[:len(mix) - i0] * 0.5

mix /= np.max(np.abs(mix)) or 1
mix *= 0.85
os.makedirs('assets/music', exist_ok=True)
with wave.open('assets/music/fondo.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('assets/music/fondo.wav', DUR, 's')
