"""Unit tests for render_gateway.py and gen_certs helpers.

Run: python3 -m unittest discover -s scripts -t . -p "*_test.py".
"""

from __future__ import annotations

import unittest

from scripts.gen_certs import parse_san_output, san_entry
from scripts.render_gateway import render_gateway_conf

TEMPLATE = "server {\n@@HTTP_LISTEN@@\n@@TLS_LISTEN@@\n}"


class RenderGatewayConfTest(unittest.TestCase):
    def test_plain_http_byte_identical_no_gaps(self) -> None:
        out = render_gateway_conf(TEMPLATE, {})
        self.assertEqual(out, "server {\n    listen 80;\n}")

    def test_redirect_adds_443_and_drops_80(self) -> None:
        out = render_gateway_conf(
            TEMPLATE, {"TLS_HOSTS": "workbench.lan", "TLS_REDIRECT": "1"}
        )
        self.assertIn("listen 443 ssl;", out)
        self.assertNotIn("listen 80;", out)

    def test_unknown_tokens_pass_through(self) -> None:
        out = render_gateway_conf("x\n@@NOPE@@\ny", {})
        self.assertEqual(out, "x\n@@NOPE@@\ny")


class SanEntryTest(unittest.TestCase):
    def test_maps_ips_and_names(self) -> None:
        self.assertEqual(san_entry("10.0.0.63"), "IP:10.0.0.63")
        self.assertEqual(san_entry("::1"), "IP:::1")
        self.assertEqual(san_entry("workbench.lan"), "DNS:workbench.lan")


class ParseSanOutputTest(unittest.TestCase):
    def test_parses_openssl_san_output(self) -> None:
        tokens = parse_san_output(
            "X509v3 Subject Alternative Name: \n    DNS:workbench.lan, DNS:localhost, IP Address:127.0.0.1\n"
        )
        self.assertEqual(
            tokens, ["DNS:workbench.lan", "DNS:localhost", "IP Address:127.0.0.1"]
        )


if __name__ == "__main__":
    unittest.main()
