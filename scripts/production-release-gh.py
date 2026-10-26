#!/usr/bin/python3
"""Run gh with a repository-scoped App token; never print authentication material."""

import base64
import datetime
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import time
import urllib.request

PERMISSIONS = {"actions": "write", "checks": "read", "contents": "read", "variables": "write"}


def encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=")


def protected_file(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError("Unsafe credential/cache permissions")


def request_token(config, key, now):
    app_id, installation_id = config["app_id"], config["installation_id"]
    if any(type(value) is not int or value <= 0 for value in [app_id, installation_id]):
        raise ValueError("Invalid App configuration")
    payload = {"iat": now - 60, "exp": now + 540, "iss": str(app_id)}
    message = encode(b'{"alg":"RS256","typ":"JWT"}') + b"." + encode(json.dumps(payload).encode())
    protected_file(key)
    signed = subprocess.run(
        ["/usr/bin/openssl", "dgst", "-sha256", "-sign", str(key)],
        input=message, capture_output=True, check=True, timeout=10,
    ).stdout
    jwt = (message + b"." + encode(signed)).decode()
    body = json.dumps({"repositories": ["levi"], "permissions": PERMISSIONS}).encode()
    request = urllib.request.Request(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        data=body, method="POST", headers={
            "Authorization": f"Bearer {jwt}", "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "levi-production-release",
            "Content-Type": "application/json",
        },
    )
    # Authentication must never follow a redirect to another endpoint.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise ValueError("Unexpected authentication redirect")
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        result = json.load(response)
    if result.get("permissions") != {**PERMISSIONS, "metadata": "read"}:
        raise ValueError("Unexpected installation token permissions")
    repositories = result.get("repositories", [])
    if len(repositories) != 1 or repositories[0].get("full_name") != "iwaseasahi/levi":
        raise ValueError("Unexpected installation token repository")
    expiry = datetime.datetime.fromisoformat(result["expires_at"].replace("Z", "+00:00")).timestamp()
    token = result["token"]
    if not isinstance(token, str) or not token or expiry < now + 300 or expiry > now + 3660:
        raise ValueError("Invalid installation token lifetime")
    return {"token": token, "expires_at": expiry}


def installation_token(config_path, key, cache, now):
    config_info = config_path.lstat()
    if not stat.S_ISREG(config_info.st_mode) or config_info.st_uid != 0 or config_info.st_mode & 0o022:
        raise ValueError("Unsafe App configuration")
    config = json.loads(config_path.read_text())
    # Bind cache to the selected installation, so replacing config cannot reuse an old identity.
    identity = json.dumps(config, sort_keys=True)
    if cache.exists():
        protected_file(cache)
        cached = json.loads(cache.read_text())
        if cached.get("identity") == identity and cached["expires_at"] > now + 300:
            return cached["token"]
    result = request_token(config, key, now)
    result["identity"] = identity
    temporary = cache.with_suffix(".new")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w") as stream:
            json.dump(result, stream)
        temporary.replace(cache)
    finally:
        temporary.unlink(missing_ok=True)
    return result["token"]


def main():
    if os.geteuid() != 0:
        raise ValueError("GitHub release identity is restricted to root")
    cache_directory = Path("/run/levi-release-auth")
    cache_directory.mkdir(mode=0o700, exist_ok=True)
    info = cache_directory.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o077:
        raise ValueError("Unsafe runtime directory")
    # Serialize token-cache updates across service and entrypoint processes.
    import fcntl
    lock_path = cache_directory / "lock"
    descriptor = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        token = installation_token(
            Path("/etc/levi/release-app.json"),
            Path(os.environ.get("CREDENTIALS_DIRECTORY", "/etc/levi")) / (
                "github-app.pem" if "CREDENTIALS_DIRECTORY" in os.environ else "release-app.pem"
            ),
            cache_directory / "token.json", int(time.time()),
        )
    environment = os.environ.copy()
    for name in ["GITHUB_TOKEN", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN", "GH_DEBUG"]:
        environment.pop(name, None)
    environment.update(GH_TOKEN=token, GH_HOST="github.com", GH_PROMPT_DISABLED="1")
    os.execve("/usr/bin/gh", ["gh", *sys.argv[1:]], environment)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # HTTP, signing and JSON exceptions can contain tokens or credential bytes.
        print("Production GitHub App authentication failed; inspect configuration and permissions without logging secrets.", file=sys.stderr)
        sys.exit(69)
