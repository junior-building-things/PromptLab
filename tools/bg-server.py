"""Local background removal for the sticker flow.

Runs the withoutbg open-weights ONNX model on CPU inside the app
container, so `api/batch-run.js` never leaves localhost for a cutout.
Speaks HTTP rather than stdin/stdout because the model has to be loaded
once and reused — a process per image would reload 455 MB every time.

  POST /remove   image bytes in, RGBA PNG out
  GET  /health   200 once the model is resident, 503 while it loads

The model loads lazily on the first request, not at import: Cloud Run
throttles CPU to near zero outside a request, so eager loading at
startup would crawl. The first cutout after a cold start pays for it.
"""

import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("BG_SERVER_PORT", "8091"))
MAX_BYTES = 32 * 1024 * 1024

_model = None
_model_lock = threading.Lock()


def get_model():
    global _model
    with _model_lock:
        if _model is None:
            from withoutbg import WithoutBG

            _model = WithoutBG.open_weights()
    return _model


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    def _send(self, status, body=b"", content_type="text/plain"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_GET(self):
        if self.path != "/health":
            return self._send(404, b"not found")
        return self._send(200, b"ready" if _model is not None else b"loading")

    def do_POST(self):
        if self.path != "/remove":
            return self._send(404, b"not found")

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            return self._send(400, b"missing or oversized image body")

        payload = self.rfile.read(length)
        # Round-trip through temp files: `remove_background` documents a
        # path as its input, and both a PIL image and a result wrapper
        # support `.save(path)`, so this holds either way.
        try:
            with tempfile.TemporaryDirectory() as workdir:
                source = os.path.join(workdir, "input")
                target = os.path.join(workdir, "output.png")
                with open(source, "wb") as handle:
                    handle.write(payload)

                get_model().remove_background(source).save(target)

                with open(target, "rb") as handle:
                    cutout = handle.read()
        except Exception as error:  # noqa: BLE001 - surfaced to the caller
            message = str(error).encode("utf-8", "replace")
            print(f"background removal failed: {error}", file=sys.stderr, flush=True)
            return self._send(500, message)

        return self._send(200, cutout, "image/png")


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"bg-server listening on {PORT}", flush=True)
    server.serve_forever()
