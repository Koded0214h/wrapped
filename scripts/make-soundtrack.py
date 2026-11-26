"""Makes public/audio/soundtrack.mp3: an original, instrumental Afrobeats-style loop.

Every sound is synthesised here, so there is no sample or song to license.
Run from the project root:  python3 scripts/make-soundtrack.py   (needs numpy and ffmpeg)
"""
import subprocess, tempfile, wave
import numpy as np

RATE = 44100
BPM = 104
STEP = 60 / BPM / 4          # one sixteenth note
BARS = 16
LENGTH = int(round(BARS * 16 * STEP * RATE))
mix = np.zeros((LENGTH, 2))
noise = np.random.default_rng(7)


def times(seconds):
    return np.arange(int(seconds * RATE)) / RATE


def add(sound, bar, step, gain=1.0, pan=0.0, swing=0.0):
    start = int(((bar * 16 + step) * STEP + (swing * STEP if step % 2 else 0)) * RATE)
    at = (start + np.arange(len(sound))) % LENGTH      # tails wrap round, so the loop has no seam
    np.add.at(mix[:, 0], at, sound * gain * min(1, 1 - pan))
    np.add.at(mix[:, 1], at, sound * gain * min(1, 1 + pan))


def faded(sound, attack=0.003, release=0.01):
    a, r = int(attack * RATE), int(release * RATE)
    sound[:a] *= np.linspace(0, 1, a)
    sound[-r:] *= np.linspace(1, 0, r)
    return sound


def bright(length, amount):
    x = noise.standard_normal(length)
    for _ in range(amount):
        x = np.diff(x, prepend=0)
    return x / np.max(np.abs(x))


def kick():
    t = times(0.32)
    pitch = 48 + 90 * np.exp(-t * 38)
    return faded(np.sin(2 * np.pi * np.cumsum(pitch) / RATE) * np.exp(-t * 11))


def rim():
    t = times(0.09)
    return faded((np.sin(2 * np.pi * 1750 * t) * 0.6 + bright(len(t), 1) * 0.5) * np.exp(-t * 70), 0.001)


def clap():
    t = times(0.18)
    body = bright(len(t), 1)
    shape = sum(np.where(t >= d, np.exp(-(t - d) * 55), 0) for d in (0, 0.011, 0.024))
    return faded(body * shape * 0.6)


def shaker(decay):
    t = times(0.09)
    return faded(bright(len(t), 2) * np.exp(-t * decay), 0.008)


def conga(freq):
    t = times(0.22)
    return faded(np.sin(2 * np.pi * freq * t * (1 + 0.25 * np.exp(-t * 40))) * np.exp(-t * 18))


def note(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def log_drum(midi, seconds):
    t = times(seconds)
    f = note(midi) * (1 + 0.6 * np.exp(-t * 45))
    phase = 2 * np.pi * np.cumsum(f) / RATE
    return faded(np.tanh(1.7 * (np.sin(phase) + 0.25 * np.sin(2 * phase))) * np.exp(-t * 5), 0.004, 0.04)


def marimba(midi, seconds=0.5):
    t = times(seconds)
    f = note(midi)
    return faded(np.sin(2 * np.pi * f * t) * np.exp(-t * 9) + 0.28 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t * 28), 0.002, 0.05)


def chord(midis, seconds):
    t = times(seconds)
    voices = sum(np.sin(2 * np.pi * note(m) * d * t) for m in midis for d in (1.0, 1.004))
    return faded(voices / (len(midis) * 2), 0.18, 0.4)


# Am7, Fmaj7, Cmaj7, G6: one chord to a bar, as (bass root, chord notes).
progression = [(33, [57, 60, 64, 67]), (29, [57, 60, 64, 65]), (36, [55, 59, 60, 64]), (31, [55, 59, 62, 64])]
# Two answering melody lines, as (step, scale note).
tune_a = [(0, 76), (3, 79), (6, 81), (10, 79), (12, 76)]
tune_b = [(2, 72), (5, 74), (8, 76), (11, 74), (14, 72)]

for bar in range(BARS):
    root, notes = progression[bar % 4]
    full = True                       # the beat is there from the first second
    breakdown = bar in (10, 11)       # and a short breather past the middle
    add(chord(notes, 16 * STEP), bar, 0, 0.17)
    for step in range(16):
        add(shaker(45 if step % 4 == 2 else 75), bar, step, 0.17 if step % 4 == 2 else 0.09, pan=0.3, swing=0.16)
    for step in (3, 6, 11, 14):
        add(rim(), bar, step, 0.26, pan=-0.25, swing=0.16)
    for step, freq in ((7, 220), (10, 220), (13, 165), (15, 175)):
        if full:
            add(conga(freq), bar, step, 0.2, pan=-0.4, swing=0.16)
    if full and not breakdown:
        for step in (0, 4, 8, 12):
            add(kick(), bar, step, 0.75)
        for step in (4, 12):
            add(clap(), bar, step, 0.2)
    if full:
        for step, up, hold in ((0, 0, 3), (3, 0, 2), (7, 7, 2), (10, 12, 2), (13, 7, 2)):
            add(log_drum(root + up, hold * STEP + 0.12), bar, step, 0.3, swing=0.16)
    for step, midi in zip((2, 5, 8, 11, 14), (notes[0], notes[2], notes[1], notes[3], notes[2])):
        add(marimba(midi + 12), bar, step, 0.13, pan=0.2, swing=0.16)
    if bar >= 4:
        for step, midi in (tune_a if bar % 2 == 0 else tune_b):
            add(marimba(midi, 0.7), bar, step, 0.19, pan=-0.1, swing=0.16)
            add(marimba(midi, 0.5), bar, step + 3, 0.05, pan=0.5, swing=0.16)

mix = np.tanh(mix * 1.1)
mix *= 0.89 / np.max(np.abs(mix))

with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
    with wave.open(tmp.name, 'wb') as out:
        out.setnchannels(2); out.setsampwidth(2); out.setframerate(RATE)
        out.writeframes((mix * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-b:a', '128k', 'public/audio/soundtrack.mp3'], check=True)
print(f'public/audio/soundtrack.mp3: {LENGTH / RATE:.1f}s loop at {BPM} bpm')
