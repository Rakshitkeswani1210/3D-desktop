#!/usr/bin/env python3
"""
serve.py — the dev server for this project.

Plain `python3 -m http.server` caches aggressively, which means you edit a
module, refresh, and see the OLD code. This project has no build step and lives
on "save the file, refresh the page", so that is fatal to the workflow.

This adds no-store headers and the correct JavaScript MIME type, so a refresh
always runs what is actually on disk.

    python3 serve.py [port]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class DevHandler(SimpleHTTPRequestHandler):
    # Make sure .js is served as a module-friendly type on every platform.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quieter: only report anything that isn't a plain 200/304.
        status = str(args[1]) if len(args) > 1 else ""
        if not status.startswith(("2", "3")):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5174
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
