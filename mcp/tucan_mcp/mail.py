"""Read-only MCP server for TU Darmstadt student email (IMAP, imap.stud.tu-darmstadt.de).

Read-only by construction: folders are opened with EXAMINE (read-only) and messages are
fetched with BODY.PEEK, so nothing is marked as read, moved, deleted or sent.
Login: the TU-ID and password saved by `tucan-mcp-setup` (system keyring).
"""

import email
import email.header
import email.utils
import imaplib
import os
import re
from datetime import date, datetime, timedelta

from bs4 import BeautifulSoup
from mcp.server.mcpserver import MCPServer

from . import credentials

HOST = os.environ.get("TU_MAIL_HOST", "imap.stud.tu-darmstadt.de")
PORT = 993

mcp = MCPServer(
    "tu-mail",
    instructions=(
        "Read-only access to the user's TU Darmstadt student mailbox. Search with mail_search, "
        "then open a message with mail_read(uid). Nothing can be sent, moved, deleted or marked as read."
    ),
)


def decode(value) -> str:
    if not value:
        return ""
    parts = []
    for text, charset in email.header.decode_header(value):
        if isinstance(text, bytes):
            try:
                text = text.decode(charset or "utf-8", errors="replace")
            except LookupError:
                text = text.decode("utf-8", errors="replace")
        parts.append(text)
    return re.sub(r"\s+", " ", "".join(parts)).strip()


class Mailbox:
    def __init__(self):
        self.conn = None

    def connect(self):
        if self.conn is not None:
            try:
                self.conn.noop()
                return self.conn
            except (imaplib.IMAP4.error, OSError):
                self.conn = None
        username, password, _ = credentials.load()
        conn = imaplib.IMAP4_SSL(HOST, PORT, timeout=30)
        conn.login(username, password)
        self.conn = conn
        return conn

    def examine(self, folder: str):
        conn = self.connect()
        typ, data = conn.select(_quote(folder), readonly=True)  # EXAMINE: read-only
        if typ != "OK":
            raise ValueError(f"Folder {folder!r} not found. Use mail_list_folders.")
        return conn


box = Mailbox()


def _quote(folder: str) -> str:
    return '"' + folder.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _imap_date(d: date) -> str:
    return d.strftime("%d-%b-%Y")


def _parse_since(since: str | None) -> date | None:
    if not since:
        return None
    since = since.strip().lower()
    m = re.fullmatch(r"(\d+)\s*(d|day|days|w|week|weeks)", since)
    if m:
        n = int(m.group(1)) * (7 if m.group(2).startswith("w") else 1)
        return date.today() - timedelta(days=n)
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(since, fmt).date()
        except ValueError:
            pass
    raise ValueError("since: use e.g. '7d', '2w', '2026-10-01' or '01.10.2026'.")


def _body_text(msg) -> tuple[str, list[str]]:
    plain, html, attachments = [], [], []
    for part in msg.walk() if msg.is_multipart() else [msg]:
        if part.is_multipart():
            continue
        disposition = (part.get("Content-Disposition") or "").lower()
        filename = part.get_filename()
        if filename or "attachment" in disposition:
            attachments.append(decode(filename) or "(unnamed)")
            continue
        payload = part.get_payload(decode=True)
        if payload is None:
            continue
        text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        (html if part.get_content_type() == "text/html" else plain).append(text)
    if plain:
        body = "\n".join(plain)
    elif html:
        body = BeautifulSoup("\n".join(html), "html.parser").get_text("\n")
    else:
        body = ""
    body = re.sub(r"\n{3,}", "\n\n", body.replace("\r", "")).strip()
    return body, attachments


@mcp.tool()
def mail_list_folders() -> str:
    """List the mailbox folders (Inbox, Sent, subfolders …)."""
    conn = box.connect()
    typ, data = conn.list()
    out = []
    for line in data or []:
        line = line.decode(errors="replace")
        m = re.search(r'\) "(.*?)" (.+)$', line)
        if m:
            name = m.group(2).strip().strip('"')
            out.append(name)
    return "\n".join(sorted(out)) or "No folders."


@mcp.tool()
def mail_search(query: str | None = None, sender: str | None = None, since: str | None = None,
                unread_only: bool = False, folder: str = "INBOX", limit: int = 20) -> str:
    """Find messages, newest first. query: words in subject or text. sender: name or address.
    since: '7d', '2w', '2026-10-01'. Returns uid, date, sender, subject; open one with mail_read(uid)."""
    try:
        conn = box.examine(folder)
        criteria = []
        if unread_only:
            criteria.append("UNSEEN")
        d = _parse_since(since)
        if d:
            criteria += ["SINCE", _imap_date(d)]
        if sender:
            criteria += ["FROM", _quote(sender)]
        if query:
            criteria += ["TEXT", _quote(query)]
        criteria = criteria or ["ALL"]
        typ, data = conn.uid("SEARCH", "CHARSET", "UTF-8", *criteria) if any(ord(c) > 127 for c in " ".join(criteria)) \
            else conn.uid("SEARCH", *criteria)
        uids = (data[0] or b"").split()
        if not uids:
            return "No messages found."
        uids = uids[-max(1, min(limit, 100)):][::-1]
        typ, data = conn.uid("FETCH", b",".join(uids), "(FLAGS BODY.PEEK[HEADER.FIELDS (DATE FROM SUBJECT)])")
        rows = {}
        for item in data:
            if not isinstance(item, tuple):
                continue
            meta = item[0].decode(errors="replace")
            uid = re.search(r"UID (\d+)", meta).group(1)
            head = email.message_from_bytes(item[1])
            when = email.utils.parsedate_to_datetime(head["Date"]) if head["Date"] else None
            unread = "\\Seen" not in meta
            rows[uid] = f"[{uid}] {when:%d.%m.%Y %H:%M} · {decode(head['From'])} · {decode(head['Subject']) or '(no subject)'}" \
                        f"{'  (unread)' if unread else ''}" if when else f"[{uid}] {decode(head['From'])} · {decode(head['Subject'])}"
        return f"{len(uids)} message(s) in {folder}:\n" + "\n".join(rows[u.decode()] for u in uids if u.decode() in rows)
    except (imaplib.IMAP4.error, OSError, ValueError, RuntimeError) as e:
        return f"Error: {e}"


@mcp.tool()
def mail_read(uid: int, folder: str = "INBOX", max_chars: int = 8000) -> str:
    """Open one message by its uid (from mail_search): headers, text and attachment names.
    The message is not marked as read."""
    try:
        conn = box.examine(folder)
        typ, data = conn.uid("FETCH", str(uid), "(BODY.PEEK[])")
        raw = next((item[1] for item in data if isinstance(item, tuple)), None)
        if raw is None:
            return f"No message with uid {uid} in {folder}."
        msg = email.message_from_bytes(raw)
        body, attachments = _body_text(msg)
        if len(body) > max_chars:
            body = body[:max_chars] + f"\n… (truncated, {len(body)} characters in total)"
        lines = [f"From: {decode(msg['From'])}", f"To: {decode(msg['To'])}"]
        if msg["Cc"]:
            lines.append(f"Cc: {decode(msg['Cc'])}")
        lines += [f"Date: {msg['Date']}", f"Subject: {decode(msg['Subject'])}"]
        if attachments:
            lines.append("Attachments: " + ", ".join(attachments))
        return "\n".join(lines) + "\n\n" + body
    except (imaplib.IMAP4.error, OSError, ValueError, RuntimeError) as e:
        return f"Error: {e}"


def main():
    mcp.run()


if __name__ == "__main__":
    main()
