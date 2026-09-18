"""Unit tests for gen_certs.py pure helpers.

Covers ensure_ca/mint_leaf/leaf_covers against the real openssl binary;
skipped when openssl is not installed.
Run: python3 -m unittest discover -s scripts -t . -p "*_test.py".
"""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from scripts import gen_certs
from scripts.gen_certs import parse_san_output, san_entry


class SanEntryTest(unittest.TestCase):
    def test_maps_ips_and_names(self) -> None:
        self.assertEqual(san_entry("10.0.0.63"), "IP:10.0.0.63")
        self.assertEqual(san_entry("::1"), "IP:::1")
        self.assertEqual(san_entry("workbench.lan"), "DNS:workbench.lan")


class ParseSanOutputTest(unittest.TestCase):
    def test_parses_openssl_output(self) -> None:
        self.assertEqual(
            parse_san_output(
                "X509v3 Subject Alternative Name: \n"
                "    DNS:workbench.lan, DNS:localhost, IP Address:127.0.0.1\n"
            ),
            ["DNS:workbench.lan", "DNS:localhost", "IP Address:127.0.0.1"],
        )

    def test_ignores_blanks(self) -> None:
        self.assertEqual(parse_san_output("\n  \n"), [])


class OpensslFlowTest(unittest.TestCase):
    """End-to-end CA + leaf flow in a temp cert dir."""

    def setUp(self) -> None:
        if shutil.which("openssl") is None and not any(
            Path(p).exists() for p in gen_certs.GIT_WINDOWS_OPENSSL
        ):
            self.skipTest("openssl not installed")
        self.tmp = Path(tempfile.mkdtemp(prefix="certs-test-"))
        self._orig = (
            gen_certs.CERT_DIR,
            gen_certs.CA_KEY,
            gen_certs.CA_CRT,
            gen_certs.LEAF_KEY,
            gen_certs.LEAF_CRT,
        )
        gen_certs.CERT_DIR = self.tmp
        gen_certs.CA_KEY = self.tmp / "ca.key"
        gen_certs.CA_CRT = self.tmp / "ca.crt"
        gen_certs.LEAF_KEY = self.tmp / "leaf.key"
        gen_certs.LEAF_CRT = self.tmp / "leaf.crt"

    def tearDown(self) -> None:
        (
            gen_certs.CERT_DIR,
            gen_certs.CA_KEY,
            gen_certs.CA_CRT,
            gen_certs.LEAF_KEY,
            gen_certs.LEAF_CRT,
        ) = self._orig
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_ca_and_leaf_round_trip(self) -> None:
        openssl = gen_certs.find_openssl()
        self.assertTrue(gen_certs.ensure_ca(openssl))
        self.assertFalse(gen_certs.ensure_ca(openssl))
        hosts = ["workbench.lan", "127.0.0.1"]
        self.assertFalse(gen_certs.leaf_covers(openssl, hosts))
        gen_certs.mint_leaf(openssl, hosts)
        self.assertTrue(gen_certs.leaf_covers(openssl, hosts))
        self.assertFalse(gen_certs.leaf_covers(openssl, ["other.lan"]))

    def test_find_openssl_names_a_binary(self) -> None:
        self.assertTrue(gen_certs.find_openssl())


if __name__ == "__main__":
    unittest.main()
