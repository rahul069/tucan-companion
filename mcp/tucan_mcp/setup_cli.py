"""Interactive setup: store the TU login in the system keyring and test it."""

import argparse
import getpass
import sys

from . import credentials, qrimport, totp
from .client import STATE, Tucan, TucanError


def pick(accounts: list[dict]) -> dict:
    if not accounts:
        raise ValueError("The QR code holds no time-based (TOTP) accounts.")
    if len(accounts) == 1:
        return accounts[0]
    for i, a in enumerate(accounts, 1):
        print(f"  {i}. {a['label'] or 'unnamed'}")
    tu = [i for i, a in enumerate(accounts) if "tu" in a["label"].lower() or "darmstadt" in a["label"].lower()]
    default = tu[0] + 1 if tu else 1
    choice = input(f"Which one is TU Darmstadt? [{default}]: ").strip()
    return accounts[int(choice) - 1 if choice else default - 1]


def ask_totp(args) -> dict:
    if args.webcam or args.qr:
        try:
            if args.webcam:
                print("Opening the webcam - hold your phone's QR code up to it (Esc to cancel) …")
                accounts = qrimport.from_webcam()
            else:
                accounts = qrimport.from_image(args.qr)
            cfg = pick(accounts)
            print(f"  Found: {cfg.get('label') or 'TOTP key'}")
            return {k: cfg[k] for k in ("secret", "digits", "period", "algorithm")}
        except (ValueError, KeyboardInterrupt) as e:
            print(f"  {e or 'Cancelled.'}")
            sys.exit(1)
    while True:
        raw = getpass.getpass("TOTP secret key or otpauth:// link (input hidden): ")
        try:
            return totp.parse(raw)
        except Exception as e:  # noqa: BLE001 - show any parse problem
            print(f"  {e} Try again.")


def main():
    ap = argparse.ArgumentParser(prog="tucan-mcp-setup", description="Save your TU login for the TUCaN MCP server.")
    ap.add_argument("--webcam", action="store_true", help="scan the TOTP QR code (e.g. Google Authenticator export) with the webcam")
    ap.add_argument("--qr", metavar="IMAGE", help="read the TOTP QR code from an image file")
    ap.add_argument("--show-link", action="store_true", help="print the otpauth:// link (e.g. to paste into the Better TUCaN extension)")
    ap.add_argument("--test", action="store_true", help="only test the saved login")
    ap.add_argument("--forget", action="store_true", help="delete the saved login and session")
    args = ap.parse_args()

    if args.forget:
        credentials.clear()
        STATE.unlink(missing_ok=True)
        print("Saved login and session deleted.")
        return

    if not args.test:
        # The key first: it's the step most likely to need a retry.
        cfg = ask_totp(args)
        print(f"  Current code: {totp.code(cfg)} - compare it with your authenticator app.")
        if args.show_link:
            print(f"  otpauth://totp/TU%20Darmstadt?secret={cfg['secret']}&digits={cfg['digits']}&period={cfg['period']}&algorithm={cfg['algorithm']}")
        print("\nYour login is stored in the system keyring (GNOME Keyring), not in a file.")
        username = input("TU-ID (e.g. ab12cdef): ").strip()
        password = getpass.getpass("Password (input hidden): ")
        credentials.save(username, password, cfg)
        print("Saved.\n")

    print("Testing the login …")
    STATE.unlink(missing_ok=True)
    try:
        t = Tucan()
        t.login()
    except (TucanError, RuntimeError) as e:
        print(f"Login failed: {e}")
        sys.exit(1)
    print(f"Logged in. Menu entries found: {len(t.menu)}")
    print("Done - restart Claude Code and ask about your TUCaN data.")


if __name__ == "__main__":
    main()
