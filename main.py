"""Serve the Dump web app locally (open the printed URL on your phone, same Wi-Fi)."""

import functools
import http.server
import socket
from pathlib import Path

PORT = 8001
WEB = Path(__file__).parent / "web"


def lan_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def main():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WEB)
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"Dump running at http://localhost:{PORT}  ·  phone: http://{lan_ip()}:{PORT}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
