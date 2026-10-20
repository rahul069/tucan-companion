"""TU-ID, password and TOTP key, kept in the system keyring (GNOME Keyring on Ubuntu)."""

import json

import keyring

SERVICE = "tucan-mcp"


def save(username: str, password: str, totp: dict) -> None:
    keyring.set_password(SERVICE, "username", username)
    keyring.set_password(SERVICE, "password", password)
    keyring.set_password(SERVICE, "totp", json.dumps(totp))


def load() -> tuple[str, str, dict]:
    username = keyring.get_password(SERVICE, "username")
    password = keyring.get_password(SERVICE, "password")
    totp = keyring.get_password(SERVICE, "totp")
    if not (username and password and totp):
        raise RuntimeError("No TUCaN login saved. Run `uv run tucan-mcp-setup` in a terminal first.")
    return username, password, json.loads(totp)


def clear() -> None:
    for key in ("username", "password", "totp"):
        try:
            keyring.delete_password(SERVICE, key)
        except keyring.errors.PasswordDeleteError:
            pass
