"""Read a TOTP key from a QR code (webcam or image), incl. Google Authenticator's export.

Everything is decoded locally; the image/frames are never saved.
"""

import base64
import time
from urllib.parse import parse_qs, unquote, urlparse

from . import totp

ALGOS = {0: "SHA1", 1: "SHA1", 2: "SHA256", 3: "SHA512"}


def _varint(buf: bytes, i: int) -> tuple[int, int]:
    n = shift = 0
    while True:
        b = buf[i]
        i += 1
        n |= (b & 0x7F) << shift
        shift += 7
        if not b & 0x80:
            return n, i


def _fields(buf: bytes):
    """Minimal protobuf reader: yields (field number, value) for varint and length-delimited fields."""
    i = 0
    while i < len(buf):
        key, i = _varint(buf, i)
        num, kind = key >> 3, key & 7
        if kind == 0:
            val, i = _varint(buf, i)
        elif kind == 2:
            size, i = _varint(buf, i)
            val, i = buf[i:i + size], i + size
        elif kind == 1:
            val, i = buf[i:i + 8], i + 8
        elif kind == 5:
            val, i = buf[i:i + 4], i + 4
        else:
            raise ValueError("Unsupported data in the export QR code.")
        yield num, val


def parse_migration(uri: str) -> list[dict]:
    """otpauth-migration://offline?data=... (Google Authenticator export) -> list of TOTP configs."""
    data = parse_qs(urlparse(uri).query)["data"][0]
    raw = base64.b64decode(unquote(data) + "=" * (-len(data) % 4))
    accounts = []
    for num, val in _fields(raw):
        if num != 1:
            continue
        acc = {"secret": b"", "name": "", "issuer": "", "algorithm": 1, "digits": 1, "type": 2}
        for f, v in _fields(val):
            if f == 1:
                acc["secret"] = v
            elif f == 2:
                acc["name"] = v.decode("utf-8", "replace")
            elif f == 3:
                acc["issuer"] = v.decode("utf-8", "replace")
            elif f == 4:
                acc["algorithm"] = v
            elif f == 5:
                acc["digits"] = v
            elif f == 6:
                acc["type"] = v
        if acc["type"] != 2:  # 1 = HOTP (counter based), not usable here
            continue
        accounts.append({
            "label": " – ".join(x for x in (acc["issuer"], acc["name"]) if x),
            "secret": base64.b32encode(acc["secret"]).decode().rstrip("="),
            "digits": 8 if acc["digits"] == 2 else 6,
            "period": 30,
            "algorithm": ALGOS.get(acc["algorithm"], "SHA1"),
        })
    return accounts


def accounts_from_text(text: str) -> list[dict]:
    if text.startswith("otpauth-migration://"):
        return parse_migration(text)
    if text.lower().startswith("otpauth://"):
        cfg = totp.parse(text)
        cfg["label"] = unquote(urlparse(text).path.lstrip("/"))
        return [cfg]
    raise ValueError("This QR code isn't an authenticator code.")


def from_image(path: str) -> list[dict]:
    import cv2
    img = cv2.imread(path)
    if img is None:
        raise ValueError(f"Can't open image {path}.")
    text, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    if not text:
        raise ValueError("No QR code found in the image.")
    return accounts_from_text(text)


def from_webcam(timeout: int = 90) -> list[dict]:
    import cv2
    cam = cv2.VideoCapture(0)
    if not cam.isOpened():
        raise ValueError("Couldn't open the webcam.")
    detector = cv2.QRCodeDetector()
    window = True
    end = time.time() + timeout
    try:
        while time.time() < end:
            ok, frame = cam.read()
            if not ok:
                continue
            text, points, _ = detector.detectAndDecode(frame)
            if window:
                try:
                    preview = cv2.flip(frame, 1)
                    cv2.putText(preview, "Hold the QR code up to the camera - Esc to cancel", (20, 40),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (90, 200, 255), 2)
                    cv2.imshow("TUCaN MCP - scan QR code", preview)
                    if cv2.waitKey(1) == 27:
                        raise KeyboardInterrupt
                except cv2.error:
                    window = False  # no display available: scan without a preview
            if text and text.startswith(("otpauth://", "otpauth-migration://")):
                return accounts_from_text(text)
        raise ValueError("No QR code seen within the time limit.")
    finally:
        cam.release()
        if window:
            cv2.destroyAllWindows()
            cv2.waitKey(1)
