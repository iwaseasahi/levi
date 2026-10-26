#!/usr/bin/python3
"""Synthetic token/signing/transport tests: no network or real credentials."""
import base64
import contextlib
import runpy
import sys
sys.dont_write_bytecode = True
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("release_auth", Path(__file__).with_name("production-release-gh.py"))
auth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(auth)


class AppAuthentication(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="levi-synthetic-auth.")
        self.root = Path(self.directory.name)
        self.key = self.root / "key.pem"
        self.key.write_text("synthetic-not-a-real-key")
        self.key.chmod(0o600)
        self.config = {"app_id": 123, "installation_id": 456}
        self.response = {"token": "synthetic-token", "expires_at": "2026-10-27T02:00:00Z", "permissions": {**auth.PERMISSIONS, "metadata": "read"}, "repositories": [{"full_name": "iwaseasahi/levi"}]}
        self.now = 1793062800  # 2026-10-27 01:00:00 UTC

    def tearDown(self):
        self.directory.cleanup()

    def token(self, response=None):
        response = self.response if response is None else response
        opener = unittest.mock.MagicMock()
        opener.open.return_value.__enter__.return_value = io.StringIO(json.dumps(response))
        with patch.object(auth.urllib.request, "build_opener", return_value=opener) as build, patch.object(auth.subprocess, "run", return_value=types.SimpleNamespace(stdout=b"synthetic-signature")) as sign:
            value = auth.request_token(self.config, self.key, self.now)
            request = opener.open.call_args.args[0]
            self.assertEqual(request.full_url, "https://api.github.com/app/installations/456/access_tokens")
            self.assertEqual(json.loads(request.data), {"repositories": ["levi"], "permissions": auth.PERMISSIONS})
            self.assertNotIn("synthetic-token", str(sign.call_args))
            signed = sign.call_args.kwargs["input"].split(b".")[1]
            payload = json.loads(base64.urlsafe_b64decode(signed + b"=" * (-len(signed) % 4)))
            self.assertEqual(payload, {"iat": self.now - 60, "exp": self.now + 540, "iss": "123"})
            handler = build.call_args.args[0]
            with self.assertRaises(ValueError):
                handler.redirect_request(None, None, 302, "", {}, "https://other.invalid")
            return value

    def test_authentication_errors_redact_exception_details(self):
        output = io.StringIO()
        with patch("os.geteuid", return_value=0), patch.object(Path, "mkdir", side_effect=RuntimeError("synthetic-private-key-marker")), contextlib.redirect_stderr(output), self.assertRaises(SystemExit) as result:
            runpy.run_path(str(Path(__file__).with_name("production-release-gh.py")), run_name="__main__")
        self.assertEqual(result.exception.code, 69)
        self.assertIn("authentication failed", output.getvalue())
        self.assertNotIn("synthetic-private-key-marker", output.getvalue())

    def test_scoped_short_lived_token(self):
        self.assertEqual(self.token()["token"], "synthetic-token")

    def test_reject_broader_permissions(self):
        with self.assertRaises(ValueError):
            self.token({**self.response, "permissions": {**self.response["permissions"], "contents": "write"}})

    def test_reject_other_repository(self):
        with self.assertRaises(ValueError):
            self.token({**self.response, "repositories": [{"full_name": "other/repo"}]})

    def test_reject_expired_and_long_lived_token(self):
        for expiry in ["2026-10-27T00:00:00Z", "2026-10-28T01:00:00Z"]:
            with self.assertRaises(ValueError):
                self.token({**self.response, "expires_at": expiry})

    def test_reject_readable_key(self):
        self.key.chmod(0o644)
        with self.assertRaises(ValueError):
            self.token()

    def test_reject_symlink_key(self):
        link = self.root / "link.pem"
        link.symlink_to(self.key)
        with self.assertRaises(ValueError):
            auth.protected_file(link)

    def test_reject_bad_identity_before_signing(self):
        self.config["app_id"] = "unexpected"
        with self.assertRaises(ValueError), patch.object(auth.subprocess, "run") as sign:
            auth.request_token(self.config, self.key, self.now)
        sign.assert_not_called()

    def cache(self):
        config = self.root / "config.json"
        config.write_text(json.dumps(self.config))
        cache = self.root / "cache.json"
        original = Path.lstat
        def metadata(path):
            if path == config:
                return types.SimpleNamespace(st_mode=stat.S_IFREG | 0o600, st_uid=0)
            return original(path)
        return config, cache, metadata

    def test_cache_reuses_valid_token_and_refreshes_expiring_token(self):
        config, cache, metadata = self.cache()
        with patch.object(Path, "lstat", metadata), patch.object(auth, "request_token", return_value={"token": "synthetic-token", "expires_at": self.now + 3600}) as mint:
            self.assertEqual(auth.installation_token(config, self.key, cache, self.now), "synthetic-token")
            self.assertEqual(stat.S_IMODE(cache.stat().st_mode), 0o600)
            self.assertEqual(auth.installation_token(config, self.key, cache, self.now + 60), "synthetic-token")
            self.assertEqual(mint.call_count, 1)
            auth.installation_token(config, self.key, cache, self.now + 3400)
            self.assertEqual(mint.call_count, 2)

    def test_cache_rejects_public_file(self):
        config, cache, metadata = self.cache()
        cache.write_text("{}")
        cache.chmod(0o644)
        with patch.object(Path, "lstat", metadata), self.assertRaises(ValueError):
            auth.installation_token(config, self.key, cache, self.now)

    def test_config_change_invalidates_cache(self):
        config, cache, metadata = self.cache()
        with patch.object(Path, "lstat", metadata), patch.object(auth, "request_token", return_value={"token": "synthetic-token", "expires_at": self.now + 3600}) as mint:
            auth.installation_token(config, self.key, cache, self.now)
            config.write_text(json.dumps({**self.config, "installation_id": 789}))
            auth.installation_token(config, self.key, cache, self.now)
            self.assertEqual(mint.call_count, 2)


if __name__ == "__main__":
    unittest.main()
