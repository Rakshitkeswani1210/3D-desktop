#!/usr/bin/env python3
"""
serve.py — the dev server for this project.

Plain `python3 -m http.server` caches aggressively, which means you edit a
module, refresh, and see the OLD code. This project has no build step and lives
on "save the file, refresh the page", so that is fatal to the workflow.

This adds no-store headers and the correct JavaScript MIME type, so a refresh
always runs what is actually on disk.

It also serves byte ranges, which SimpleHTTPRequestHandler does not do at all.
Without that an <audio> element cannot seek: asking to jump to 1:48 of a track
needs a 206 Partial Content response, and a server that answers every request
with the whole file and a 200 leaves the browser no way to get there. The
symptom is a scrub bar that snaps back to the start rather than an error, which
is a genuinely annoying thing to debug from the client side.

    python3 serve.py [port]
"""

import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Media is static during development and is the one thing worth letting the
# browser keep: re-fetching 3MB of audio on every seek is slow, and no-store
# would forbid exactly the buffering that makes scrubbing feel instant.
CACHEABLE = {".mp3", ".ogg", ".wav", ".m4a", ".mp4", ".webm"}

RANGE_RE = re.compile(r"^bytes=(\d*)-(\d*)$")


class DevHandler(SimpleHTTPRequestHandler):
    # Make sure .js is served as a module-friendly type on every platform.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }

    def end_headers(self):
        if Path(self.path.split("?")[0]).suffix.lower() in CACHEABLE:
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "public, max-age=3600")
        else:
            self.send_header("Cache-Control", "no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quieter: only report anything that isn't a plain 200/304.
        status = str(args[1]) if len(args) > 1 else ""
        if not status.startswith(("2", "3")):
            super().log_message(fmt, *args)

    def send_head(self):
        """Serve a single byte range as 206, or defer to the base handler."""
        header = self.headers.get("Range")
        if not header:
            return super().send_head()

        match = RANGE_RE.match(header.strip())
        if not match:
            return super().send_head()   # multi-range: not worth supporting here

        path = self.translate_path(self.path)
        try:
            fh = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return None

        try:
            size = fh.seek(0, 2)
            first, last = match.group(1), match.group(2)
            if first:
                start = int(first)
                end = int(last) if last else size - 1
            else:
                # "bytes=-500" means the LAST 500 bytes, not the first 500.
                start = max(0, size - int(last or 0))
                end = size - 1
            end = min(end, size - 1)

            if start > end or start >= size:
                self.send_response(416, "Requested Range Not Satisfiable")
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                fh.close()
                return None

            self.send_response(206, "Partial Content")
            self.send_header("Content-type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            fh.seek(start)
            # copyfile() would send to EOF, so hand back a reader capped at the
            # requested length instead.
            return _Ranged(fh, end - start + 1)
        except Exception:
            fh.close()
            raise


class _Ranged:
    """A read-only file view that stops after `remaining` bytes."""

    def __init__(self, fh, remaining):
        self._fh = fh
        self._remaining = remaining

    def read(self, n=-1):
        if self._remaining <= 0:
            return b""
        if n is None or n < 0:
            n = self._remaining
        chunk = self._fh.read(min(n, self._remaining))
        self._remaining -= len(chunk)
        return chunk

    def close(self):
        self._fh.close()


def main():
    # An explicit argument wins, then PORT from the environment, then the
    # default. The env var is what lets a supervisor that assigns ports — the
    # editor's preview launcher, say — start this without colliding with a copy
    # already running by hand on 5174.
    port = int(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORT") or 5174)
    handler = partial(DevHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"iPod classic — serving {ROOT}")
    print(f"  scene   http://localhost:{port}/index.html")
    print(f"  viewer  http://localhost:{port}/viewer.html")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
