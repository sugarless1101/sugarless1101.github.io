"""Build the served lamp, signal and pole images from the full-size masters (Pillow).

The hero lamp layers are full-frame photographs, but the page only shows a few boxes of them.
Each served file is cropped to the box its element clips to, so a phone no longer decodes
41 MB bitmaps that are almost entirely transparent. The signal and pole photographs are
resized to cover their largest on-screen size at 3x.

Run from the repository root after changing a master in images/masters/, then raise
IMAGE_VERSION in main.js and run `node tools/version-images.mjs`.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'images'
MASTERS = ROOT / 'masters'

# Boxes in 1x frame pixels (tall frame 1200x2133, wide frame 2400x1350). They must equal
# lb (lamp surface), dg (day glow) and gb (lantern glass) in main.js. PAD frame pixels are kept
# around each box (transparent past the frame edge), matching `pad` in main.js, so every image
# still overlaps its clip box after the browser snaps it to device pixels.
LAMP = {'tall': (363, 800, 284, 1333), 'wide': (631, 144, 258, 1206)}
GLOW = {'tall': (446, 1000, 194, 202), 'wide': (706, 326, 174, 182)}
GLASS = {'tall': (448, 1002, 181, 195), 'wide': (708, 327, 163, 176)}
PAD = 4


def crop(name, box, scale):
    x, y, w, h = box
    edges = ((x - PAD) * scale, (y - PAD) * scale, (x + w + PAD) * scale, (y + h + PAD) * scale)
    with Image.open(MASTERS / 'layers' / name) as image:
        image.convert('RGBA').crop(edges).save(ROOT / 'layers' / name, 'WEBP', quality=95, method=6)


def resize(name, width):
    with Image.open(MASTERS / 'fixtures' / name) as image:
        height = round(image.height * width / image.width)
        image.resize((width, height), Image.Resampling.LANCZOS).save(
            ROOT / 'fixtures' / name, 'WEBP', quality=90, method=6)


count = 0
for frame in ['tall', 'wide']:
    for scale, tag in [(1, ''), (2, '-2x')]:
        for state in ['', '-dim', '-off']:
            crop(f'lamp-{frame}{tag}{state}.webp', LAMP[frame], scale)
        for state in ['', '-off']:
            crop(f'lamp-{frame}-night{tag}{state}.webp', LAMP[frame], scale)
        crop(f'lamp-{frame}{tag}-glow.webp', GLOW[frame], scale)
        crop(f'lamp-glass-mask-{frame}{tag}.webp', GLASS[frame], scale)
        count += 7
# Largest display: the final pole at 540 CSS px, the signal at 360 CSS px (see DESIGN.md).
for name in ['pole', 'pole-night', 'pole-finale-night']:
    resize(f'{name}.webp', 1600)
    count += 1
for name in ['signal-pole', 'signal-pole-night', 'signal-head-off', 'signal-head-on',
             'signal-head-off-night', 'signal-head-yellow-night']:
    resize(f'{name}.webp', 1000)
    count += 1
print(f'Built {count} images from images/masters.')
