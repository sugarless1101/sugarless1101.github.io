"""Check local asset references, including generated image families, case-sensitively.

Run with Python 3.8+ from any directory. No network or browser is used.
Unknown JavaScript template expressions fail instead of silently skipping assets.
"""
from html.parser import HTMLParser
from itertools import product
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ASSET = re.compile(r"(?:images/|\./|\.\./)(?:\$\{[^}]*\}|[^\s\"'`()<>?])+?\.(?:webp|png|jpe?g|svg|avif|gif|css|js|mjs|json|pdf|woff2?)", re.I)
QUOTED = re.compile(r"(['\"])(.*?)\1")


def strings(value):
    return [match[1] for match in QUOTED.findall(value)]


class Markup(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.refs = []
        self.attrs = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.attrs.append((tag, attrs))
        for key in ('src', 'href', 'poster', 'data', 'data-src', 'data-href', 'data-background', 'data-mask'):
            if key in attrs:
                self.refs.append(attrs[key])
        for key in ('srcset', 'data-srcset'):
            if key in attrs:
                self.refs.extend(part.strip().split()[0] for part in attrs[key].split(',') if part.strip())
        if tag == 'meta' and attrs.get('property') in ('og:image', 'og:video', 'og:audio'):
            self.refs.append(attrs.get('content', ''))


def css_refs(source):
    source = re.sub(r'/\*.*?\*/', '', source, flags=re.S)
    return [next(value for value in match if value) for match in re.findall(
        r'url\(\s*(?:"([^"]+)"|\x27([^\x27]+)\x27|([^\s)]+))\s*\)', source)] + re.findall(
        r'@import\s+["\x27]([^"\x27]+)', source)


def js_refs(source, page):
    refs = []
    # Read the finite families from the production code rather than file globs:
    # a missing member must fail even when its neighbours exist.
    clouds = strings(re.search(r"const cloudLayers=(\[[^\]]+\])", source)[1])
    cumulus = strings(re.search(r"const name=(\[[^\]]+\])\.find", source)[1])
    parts = json.loads(re.search(r'const wirePartDefinitions\s*=\s*(\[.*?\]);', source)[1])
    states = strings(re.search(r"const pedPhotos=.*?\.map\(mode=>(\[[^\]]+\])", source)[1])
    for match in ASSET.finditer(source):
        path = match[0]
        if '${stem}' in path or '${folder}' in path:
            continue  # Expanded below using actual function arguments.
        choices = []
        for expression in re.findall(r'\$\{([^}]+)\}', path):
            if expression == 'depth':
                values = clouds
            elif expression == 'variant':
                values = ['wide', 'tall']
                if '-2x-glow' not in path:
                    values += strings(re.search(r"finaleDayGlow=splitDayLamp\([^,]+,('.*?')\)", source)[1])
            elif expression == 'def.name':
                values = [part['name'] for part in parts]
            elif expression == 'name' and path.startswith('images/cumulonimbus/'):
                values = cumulus
            elif expression == 'name' and '/ped-signal/' in path:
                values = ['ped-signal-' + state + suffix for state, suffix in product(states, ['', '-night'])]
            elif '?' in expression or expression.startswith('['):
                values = strings(expression.split('?', 1)[1] if '?' in expression else expression)
            else:
                raise ValueError('Unsupported image expression: ${' + expression + '}')
            if not values:
                raise ValueError('No variants for ' + path)
            choices.append(values)
        for values in product(*choices):
            expanded = path
            for value in values:
                expanded = re.sub(r'\$\{[^}]+\}', lambda _: value, expanded, count=1)
            refs.append(expanded)
    for stem, high in re.findall(r"layerPicture\('([^']+)','[^']+'(,true)?\)", source):
        refs.extend('images/layers/{}-{}.webp'.format(stem, orientation)
                    for orientation in ['wide', 'tall'])
        if high:
            refs.extend('images/layers/{}-{}-2x.webp'.format(stem, orientation)
                        for orientation in ['wide', 'tall'])
    for folder, names in re.findall(r"spritePoses\([^,]+,'([^']+)',(\[[^\]]+\])\)", source):
        refs.extend('images/fixtures/{}/{}{}.webp'.format(folder, name, density)
                    for name, density in product(strings(names), ['', '-2x']))
    # Literal local files outside images/ (imports, fetches, downloads, etc.).
    for literal in strings(source):
        if re.fullmatch(r'[^\s`{}$]+\.(?:css|js|mjs|json|pdf|webp|png|svg|woff2?)(?:[?#].*)?', literal) and not literal.startswith(('.', '-')):
            refs.append(literal)
    # Images whose mode/off/dim URLs are formed with String.replace().
    selectors = strings(re.search(r"(\[[^\]]+\])\.forEach\(selector=>", source)[1])
    for selector in selectors:
        cls = selector.lstrip('.')
        holder = next(i for i, (_, attrs) in enumerate(page.attrs) if cls in attrs.get('class', '').split())
        image = next(attrs.get('src') or attrs['data-src'] for tag, attrs in page.attrs[holder + 1:] if tag == 'img')
        refs.append(image.replace('.webp', '-night.webp'))
    refs.extend('images/layers/lamp-{}{}-dim.webp'.format(shape, density)
                for shape in ['wide', 'tall', 'finale'] for density in (['', '-2x'] if shape != 'finale' else ['']))
    refs.extend('images/layers/lamp-{}{}{}-off.webp'.format(shape, mode, density)
                for shape, mode, density in product(['wide', 'tall'], ['', '-night'], ['', '-2x']))
    refs.extend('images/layers/clouds-{}{}-{}.webp'.format(depth, mode, width)
                for depth, mode, width in product(clouds, ['', '-night'], [2400, 3600]))
    return refs


def check_reference(ref):
    url = urlsplit(ref)
    if not url.path or url.scheme or url.netloc:
        return None
    parts = unquote(url.path).replace('\\', '/').lstrip('/').split('/')
    current = ROOT
    for part in parts:
        if part in ('', '.'):
            continue
        if part == '..':
            return 'path leaves the site root: ' + ref
        if not current.is_dir():
            return 'missing: ' + ref
        names = {entry.name for entry in current.iterdir()}
        if part not in names:
            similar = next((name for name in names if name.casefold() == part.casefold()), None)
            return ('case mismatch ({} should be {}): '.format(part, similar) if similar else 'missing: ') + ref
        current /= part
    if not current.is_file():
        return 'not a file: ' + ref
    return None


def main():
    try:
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        page = Markup(html)
        sources = {
            'index.html': page.refs + css_refs(html),
            'style.css': css_refs((ROOT / 'style.css').read_text(encoding='utf-8')),
            'main.js': js_refs((ROOT / 'main.js').read_text(encoding='utf-8'), page),
        }
        checked = 0
        errors = []
        for source, refs in sources.items():
            for ref in sorted(set(refs)):
                if urlsplit(ref).path and not urlsplit(ref).scheme and not urlsplit(ref).netloc:
                    checked += 1
                error = check_reference(ref)
                if error:
                    errors.append(source + ': ' + error)
        for error in errors:
            print(error)
        print('{}: {} local references, {} errors'.format('FAIL' if errors else 'PASS', checked, len(errors)))
        return 1 if errors else 0
    except (OSError, ValueError, TypeError, AttributeError) as error:
        print('FAIL: ' + str(error))
        return 1


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main())
