"""Rebuild responsive WebP derivatives from existing photographs (Pillow)."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'images'


def resize(source, destination, width, quality=90):
    with Image.open(ROOT / source) as image:
        height = round(image.height * width / image.width)
        image.resize((width, height), Image.Resampling.LANCZOS).save(
            ROOT / destination, 'WEBP', quality=quality, method=6)


for mode in ['night', 'summer']:
    resize(f'sky-{mode}-5120.webp', f'sky-{mode}-1200.webp', 1200)
    resize(f'layers/sky-{mode}-tall.webp', f'layers/sky-{mode}-tall-384.webp', 384)
resize('sky-night-5120.webp', 'sky-night-2560.webp', 2560)
for depth in ['haze', 'far', 'mid', 'near']:
    for mode in ['', '-night']:
        for width in [2400, 3600]:
            resize(f'layers/clouds-{depth}{mode}.webp',
                   f'layers/clouds-{depth}{mode}-{width}.webp', width)
print('Rebuilt 21 responsive WebP images at quality 90.')
