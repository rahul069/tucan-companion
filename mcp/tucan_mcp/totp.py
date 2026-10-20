"""TOTP (RFC 6238) codes and otpauth:// parsing."""

import base64
import hashlib
import hmac
import struct
import time
from urllib.parse import parse_qs, urlparse

ALGORITHMS = {"SHA1": hashlib.sha1, "SHA256": hashlib.sha256, "SHA512": hashlib.sha512}


def parse(value: str) -> dict:
    """Accept a bare base32 key or an otpauth://totp/... URI; return a normalised config."""
    value = value.strip()
    cfg = {"secret": value, "digits": 6, "period": 30, "algorithm": "SHA1"}
    if value.lower().startswith("otpauth://"):
        url = urlparse(value)
        if url.netloc.lower() != "totp":
            raise ValueError("Only time-based (TOTP) keys are supported.")
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        cfg.update(
            secret=q.get("secret", ""),
            digits=int(q.get("digits", 6)),
            period=int(q.get("period", 30)),
            algorithm=q.get("algorithm", "SHA1").upper(),
        )
    cfg["secret"] = cfg["secret"].upper().replace(" ", "").replace("-", "").rstrip("=")
    if cfg["algorithm"] not in ALGORITHMS:
        raise ValueError(f"Unsupported algorithm {cfg['algorithm']}.")
    if len(_key(cfg["secret"])) < 10:
        raise ValueError("That key looks too short.")
    return cfg


def _key(secret: str) -> bytes:
    return base64.b32decode(secret + "=" * (-len(secret) % 8))


def counter(cfg: dict, now: float | None = None) -> int:
    return int((now or time.time()) // cfg["period"])


def code(cfg: dict, now: float | None = None) -> str:
    msg = struct.pack(">Q", counter(cfg, now))
    h = hmac.new(_key(cfg["secret"]), msg, ALGORITHMS[cfg["algorithm"]]).digest()
    o = h[-1] & 0x0F
    n = struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF
    return str(n % 10 ** cfg["digits"]).zfill(cfg["digits"])
