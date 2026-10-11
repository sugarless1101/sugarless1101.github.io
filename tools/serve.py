"""Serve the static site locally with concurrent image requests (Python 3.8+)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import mimetypes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('port', type=int, nargs='?', default=4175)
    parser.add_argument('directory', nargs='?', default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args()
    directory = Path(args.directory).resolve()
    if not directory.is_dir():
        parser.error('directory does not exist')
    mimetypes.add_type('image/webp', '.webp')
    handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
    with ThreadingHTTPServer(('127.0.0.1', args.port), handler) as server:
        print('Serving http://127.0.0.1:{}/ (Ctrl+C to stop)'.format(args.port), flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
