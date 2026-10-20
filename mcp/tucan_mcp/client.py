"""Read-only TUCaN client: TU SSO login (password + TOTP), menu discovery, page -> text.

Read-only by construction: after login it only sends GET requests to TUCaN, plus the
"choose a semester" filter forms. Links that register, deregister, log out or change
settings are never offered for following.
"""

import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Comment, Tag

from . import credentials, totp

BASE = "https://www.tucan.tu-darmstadt.de"
WELCOME = BASE + "/scripts/mgrqispi.dll?APPNAME=CampusNet&PRGNAME=EXTERNALPAGES&ARGUMENTS=-N000000000000001,-N000344,-Awelcome"
STATE = Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "tucan-mcp" / "state.json"
SESSION_RE = re.compile(r"ARGUMENTS=-N(\d{15})")
GUEST_SESSIONS = {"000000000000001", "000000000000002"}

# Never follow links that change something.
UNSAFE_TEXT = re.compile(r"^(register|deregister|unregister|anmelden|abmelden|cancel|stornieren|log ?out|abmeldung|delete|löschen|"
                         r"zurückziehen|withdraw|enrol|enroll|sign ?up|sign ?off|einschreiben|austragen|"
                         r"send|senden|absenden|submit|confirm|bestätigen)\b", re.I)
UNSAFE_PRG = {"LOGOUT", "CHANGELANGUAGE", "REGCOURSEMOD", "REGEXAMMOD", "CREATEDOCUMENT", "PERSADDRESSCHANGE"}


class TucanError(RuntimeError):
    pass


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def prgname(url: str) -> str:
    m = re.search(r"PRGNAME=([A-Z_]+)", url or "")
    return m.group(1) if m else ""


class Tucan:
    def __init__(self):
        self.http = requests.Session()
        self.http.headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) tucan-mcp"
        self.session_id: str | None = None
        self.menu: list[dict] = []          # [{text, prg, url, depth}]
        self.links: dict[int, str] = {}     # numbered links of the last page
        self._load_state()

    # ------------------------------------------------------------------ state
    def _load_state(self):
        try:
            s = json.loads(STATE.read_text())
            self.session_id = s.get("session_id")
            self.menu = s.get("menu", [])
            for c in s.get("cookies", []):
                self.http.cookies.set(c["name"], c["value"], domain=c["domain"], path=c["path"])
        except (OSError, ValueError, KeyError):
            pass

    def _save_state(self, last_counter: int | None = None):
        STATE.parent.mkdir(parents=True, exist_ok=True)
        old = {}
        try:
            old = json.loads(STATE.read_text())
        except (OSError, ValueError):
            pass
        data = {
            "session_id": self.session_id,
            "menu": self.menu,
            "cookies": [{"name": c.name, "value": c.value, "domain": c.domain, "path": c.path}
                        for c in self.http.cookies],
            "last_counter": last_counter if last_counter is not None else old.get("last_counter"),
        }
        STATE.write_text(json.dumps(data))
        os.chmod(STATE, 0o600)

    # ------------------------------------------------------------------ login
    def login(self) -> None:
        username, password, otp_cfg = credentials.load()
        self.http.cookies.clear()
        self.session_id = None

        welcome = self.http.get(WELCOME, timeout=30)
        soup = BeautifulSoup(welcome.text, "html.parser")
        btn = soup.select_one("a#logIn_btn")
        if not btn:
            raise TucanError("Couldn't find TUCaN's login button.")
        r = self.http.get(urljoin(welcome.url, btn["href"]), timeout=30)

        sent_password = sent_otp = False
        for _ in range(25):
            soup = BeautifulSoup(r.text, "html.parser")
            host = urlparse(r.url).netloc

            if host.endswith("tucan.tu-darmstadt.de") and "dsf." not in host:
                sid = self._find_session(r, soup)
                if sid:
                    self.session_id = sid
                    break

            nxt = self._refresh_target(r, soup)
            if nxt:
                r = self.http.get(urljoin(r.url, nxt), timeout=30)
                continue

            # Identity server "pick a provider": TU-ID via Shibboleth.
            provider = soup.select_one("a.provider-link.dfnshib, a.provider-link")
            if provider and "dsf." in host:
                r = self.http.get(urljoin(r.url, provider["href"]), timeout=30)
                continue

            form = soup.find("input", attrs={"name": "j_username"})
            if form:
                if sent_password:
                    raise TucanError("TU login rejected the username/password: " + self._idp_error(soup))
                form = form.find_parent("form")
                data = self._form_fields(form)
                data.update(j_username=username, j_password=password, _eventId_proceed="")
                data.pop("donotcache", None)
                data.pop("_shib_idp_revokeConsent", None)
                r = self.http.post(urljoin(r.url, form.get("action") or r.url), data=data, timeout=30)
                sent_password = True
                continue

            otp_field = self._otp_field(soup)
            if otp_field is not None:
                if sent_otp:
                    raise TucanError("TU login rejected the one-time code: " + self._idp_error(soup))
                form = otp_field.find_parent("form")
                data = self._form_fields(form)
                data[otp_field["name"]] = self._fresh_code(otp_cfg)
                button = self._submit_button(form, r"^(validate|validieren|prüfen|login|anmelden|ok|weiter)$")
                if button is not None and button.get("name"):
                    data[button["name"]] = button.get("value", "")
                elif "_eventId_proceed" not in data:
                    data["_eventId_proceed"] = ""
                r = self.http.post(urljoin(r.url, form.get("action") or r.url), data=data, timeout=30)
                sent_otp = True
                continue

            # Attribute-release consent: accept once (remember the choice).
            if soup.find("input", attrs={"name": "_shib_idp_consentOptions"}):
                form = soup.find("input", attrs={"name": "_shib_idp_consentOptions"}).find_parent("form")
                data = self._form_fields(form)
                data["_shib_idp_consentOptions"] = "_shib_idp_rememberConsent"
                data["_eventId_proceed"] = "Accept"
                r = self.http.post(urljoin(r.url, form.get("action") or r.url), data=data, timeout=30)
                continue

            # Hidden-only forms that the browser would auto-submit (SAMLResponse, OIDC, storage checks).
            auto = self._auto_form(soup)
            if auto is not None:
                data = self._form_fields(auto)
                method = (auto.get("method") or "post").lower()
                url = urljoin(r.url, auto.get("action") or r.url)
                r = self.http.post(url, data=data, timeout=30) if method == "post" else self.http.get(url, params=data, timeout=30)
                continue

            raise TucanError(f"Login got stuck at {r.url.split('?')[0]}: " + clean(soup.get_text())[:300])
        else:
            raise TucanError("Login took too many steps.")

        start = self._get_raw(self._start_url())
        self._read_menu(BeautifulSoup(start.text, "html.parser"))
        self._english(start)
        self._save_state()

    def _fresh_code(self, cfg: dict) -> str:
        # The same code can't be used twice; also avoid one that expires mid-request.
        try:
            last = json.loads(STATE.read_text()).get("last_counter")
        except (OSError, ValueError):
            last = None
        while totp.counter(cfg) == last or cfg["period"] - time.time() % cfg["period"] < 3:
            time.sleep(1)
        self._save_state(last_counter=totp.counter(cfg))
        return totp.code(cfg)

    @staticmethod
    def _find_session(r, soup) -> str | None:
        for text in [r.url, r.headers.get("Refresh", "")] + [a.get("href", "") for a in soup.find_all("a")] + \
                [m.get("content", "") for m in soup.find_all("meta")]:
            m = SESSION_RE.search(text)
            if m and m.group(1) not in GUEST_SESSIONS:
                return m.group(1)
        return None

    @staticmethod
    def _refresh_target(r, soup) -> str | None:
        header = r.headers.get("Refresh", "")
        meta = soup.find("meta", attrs={"http-equiv": re.compile("refresh", re.I)})
        value = header or (meta.get("content", "") if meta else "")
        m = re.search(r"url\s*=\s*['\"]?([^'\"]+)", value, re.I)
        return m.group(1) if m else None

    @staticmethod
    def _form_fields(form: Tag) -> dict:
        data = {}
        for el in form.find_all(["input", "select", "textarea"]):
            name = el.get("name")
            if not name:
                continue
            kind = (el.get("type") or "").lower()
            if el.name == "select":
                opt = el.find("option", selected=True) or el.find("option")
                data[name] = opt.get("value", opt.get_text()) if opt else ""
            elif kind in ("checkbox", "radio"):
                if el.has_attr("checked"):
                    data[name] = el.get("value", "on")
            elif kind not in ("submit", "button", "image"):
                data[name] = el.get("value", "")
        return data

    @staticmethod
    def _otp_field(soup) -> Tag | None:
        page = soup.get_text(" ")
        if not re.search(r"one-time|OTP|TOTP|Einmal|Insert Response|token", page, re.I):
            return None
        for el in soup.find_all("input"):
            kind = (el.get("type") or "text").lower()
            style = (el.get("style") or "").replace(" ", "")
            if kind in ("text", "password", "tel", "number") and el.get("name") and "display:none" not in style \
                    and not re.search(r"user|passw|assertion", el["name"], re.I):
                return el
        return None

    @staticmethod
    def _submit_button(form: Tag, pattern: str) -> Tag | None:
        buttons = form.find_all(["button", "input"], attrs={"type": re.compile("submit", re.I)}) + \
            [b for b in form.find_all("button") if not b.get("type")]
        for b in buttons:
            if re.search(pattern, clean(b.get_text() or b.get("value", "")), re.I):
                return b
        return buttons[0] if buttons else None

    @staticmethod
    def _auto_form(soup) -> Tag | None:
        for form in soup.find_all("form"):
            inputs = form.find_all("input")
            if inputs and all((i.get("type") or "text").lower() in ("hidden", "submit") for i in inputs) \
                    and any(i.get("type", "").lower() == "hidden" for i in inputs):
                return form
        return None

    @staticmethod
    def _idp_error(soup) -> str:
        el = soup.select_one(".form-error, .output--error, .error, .alert-danger, [class*=error]")
        return clean(el.get_text()) if el else "no reason given"

    def _start_url(self) -> str:
        return f"{BASE}/scripts/mgrqispi.dll?APPNAME=CampusNet&PRGNAME=MLSSTART&ARGUMENTS=-N{self.session_id},-N000019,"

    def _english(self, start):
        """Switch TUCaN to English if it's in German (the account's language setting)."""
        soup = BeautifulSoup(start.text, "html.parser")
        if soup.select_one(".img_LangGerman"):
            return  # already English: the switch offers German
        link = soup.select_one("a.img_LangEnglish")
        if link and link.get("href"):
            r = self._get_raw(urljoin(BASE, link["href"]))
            self._read_menu(BeautifulSoup(r.text, "html.parser"))

    def _read_menu(self, soup):
        menu = []
        for a in soup.select("#pageTopNavi a.navLink"):
            depth = next((int(c[-1]) for c in a.get("class", []) if re.fullmatch(r"depth_\d", c)), 1)
            menu.append({"text": clean(a.get_text()), "prg": prgname(a.get("href")), "url": urljoin(BASE, a.get("href")), "depth": depth})
        if menu:
            self.menu = menu

    # ------------------------------------------------------------------ fetching
    def _get_raw(self, url: str):
        r = self.http.get(url, timeout=30)
        r.encoding = r.apparent_encoding if r.encoding in (None, "ISO-8859-1") else r.encoding
        return r

    def _logged_out(self, r) -> bool:
        # Logged-in pages carry the session number in every menu link; the timeout and
        # welcome pages show the login button instead.
        return 'id="logIn_btn"' in r.text or (self.session_id or "-") not in r.text

    def get(self, url: str) -> BeautifulSoup:
        """GET a TUCaN page, logging in (again) when the session is missing or expired."""
        if urlparse(url).netloc not in ("", "www.tucan.tu-darmstadt.de"):
            raise TucanError("Only TUCaN pages can be opened.")
        if not self.session_id:
            self.login()
        old = self.session_id
        r = self._get_raw(self._with_session(url, old))
        if self._logged_out(r):
            self.login()
            r = self._get_raw(self._with_session(url, old))
        self._save_state()
        soup = BeautifulSoup(r.text, "html.parser")
        soup.url = r.url  # type: ignore[attr-defined]
        return soup

    def _with_session(self, url: str, old: str | None) -> str:
        url = urljoin(BASE, url)
        if old and self.session_id and old != self.session_id:
            url = url.replace(old, self.session_id)
        return url

    def submit_filter(self, soup: BeautifulSoup, choice: str) -> BeautifulSoup:
        """Pick an option (e.g. a semester) in the page's filter dropdown and reload."""
        for select in soup.select("#pageContent select"):
            form = select.find_parent("form")
            if not form or form.find("input", attrs={"type": re.compile("^(text|password)$", re.I)}):
                continue
            options = select.find_all("option")
            want = choice.lower().replace("winter term", "wise").replace("summer term", "sose")
            match = next((o for o in options if choice.lower() in clean(o.get_text()).lower()), None) or \
                next((o for o in options if want in clean(o.get_text()).lower()), None)
            if not match:
                raise TucanError(f"No option '{choice}'. Available: " + ", ".join(clean(o.get_text()) for o in options))
            data = self._form_fields(form)
            data[select["name"]] = match.get("value", clean(match.get_text()))
            url = urljoin(getattr(soup, "url", BASE), form.get("action") or "")
            if (form.get("method") or "get").lower() == "post":
                r = self.http.post(url, data=data, timeout=30)
            else:
                r = self.http.get(url, params=data, timeout=30)
            r.encoding = r.apparent_encoding if r.encoding in (None, "ISO-8859-1") else r.encoding
            new = BeautifulSoup(r.text, "html.parser")
            new.url = r.url  # type: ignore[attr-defined]
            return new
        raise TucanError("This page has no semester/filter selection.")

    def menu_url(self, prg: str | None = None, text: str | None = None) -> str:
        if not self.menu:
            self.login()
        for item in self.menu:
            if (prg and item["prg"] == prg) or (text and re.fullmatch(text, item["text"], re.I)):
                return item["url"]
        raise TucanError(f"Menu entry {prg or text} not found.")

    # ------------------------------------------------------------------ page -> text
    def to_text(self, soup: BeautifulSoup, numbered_links: bool = True) -> str:
        root = soup.select_one("#pageContent") or soup.body or soup
        for el in root.select("script, style, noscript"):
            el.decompose()
        for el in root.select('[style*="display:none"], [style*="display: none"], [class^=loginData], #loginDataContainer'):
            el.decompose()
        for c in root.find_all(string=lambda t: isinstance(t, Comment)):
            c.extract()
        self.links = {}

        def link_ref(a: Tag) -> str:
            href = a.get("href") or ""
            text = clean(a.get_text())
            if not href or href.startswith(("#", "javascript")) or not text:
                return text
            if prgname(href) in UNSAFE_PRG or UNSAFE_TEXT.search(text):
                return text
            if not numbered_links:
                return text
            n = len(self.links) + 1
            self.links[n] = urljoin(BASE, href)
            return f"{text} [{n}]"

        def inline(el) -> str:
            if isinstance(el, str):
                return el
            if el.name == "a":
                return link_ref(el)
            if el.name == "br":
                return " / "
            if el.name == "select":
                opt = el.find("option", selected=True) or el.find("option")
                return f"[{clean(opt.get_text()) if opt else ''} ▾]"
            if el.name == "input" and el.get("type") in ("submit", "button"):
                return ""
            return "".join(inline(c) for c in el.children)

        lines: list[str] = []

        def block(el):
            for child in el.children:
                if isinstance(child, str):
                    if clean(child):
                        lines.append(clean(child))
                    continue
                if child.name in ("h1", "h2", "h3", "h4"):
                    lines.append("\n" + "#" * (int(child.name[1]) + 1) + " " + clean(inline(child)))
                elif child.name == "table":
                    caption = child.find("caption")
                    if caption:
                        lines.append("\n### " + clean(inline(caption)))
                    for tr in child.find_all("tr"):
                        if tr.find_parent("table") is not child:
                            continue
                        cells = [clean(inline(td)) for td in tr.find_all(["td", "th"], recursive=False)]
                        while cells and not cells[-1]:
                            cells.pop()
                        if any(cells):
                            lines.append("| " + " | ".join(cells) + " |")
                    lines.append("")
                elif child.name in ("ul", "ol"):
                    for li in child.find_all("li", recursive=False):
                        lines.append("- " + clean(inline(li)))
                elif child.name in ("p", "span", "a", "b", "strong", "em", "label"):
                    t = clean(inline(child))
                    if t:
                        lines.append(t)
                elif child.name in ("form", "div", "section", "fieldset", "center", "main", "article"):
                    block(child)
                else:
                    t = clean(inline(child))
                    if t:
                        lines.append(t)

        block(root)
        text = "\n".join(lines)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    # ------------------------------------------------------------------ schedule
    def week_appointments(self, soup: BeautifulSoup) -> tuple[str, list[dict]]:
        """Parse the week grid (rowspans and all) into a list of appointments per day."""
        cell = soup.select_one("td.appointment")
        table = cell.find_parent("table") if cell else None
        title = ""
        caption = soup.select_one("#pageContent caption") or soup.find(string=re.compile(r"\bCW\s*\d+|KW\s*\d+"))
        if caption:
            title = clean(caption.get_text() if isinstance(caption, Tag) else caption)
        sel = soup.select_one("#pageContent select option[selected]")
        if sel:
            title = clean(sel.get_text())
        if not table:
            return title, []
        day_re = re.compile(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Mo|Di|Mi|Do|Fr|Sa|So)\b")
        grid: dict[tuple[int, int], Tag] = {}
        pos: dict[int, int] = {}
        rows = [tr for tr in table.find_all("tr") if tr.find_parent("table") is table]
        day_cols: dict[int, str] = {}
        header_row = None
        for r, tr in enumerate(rows):
            c = 0
            for td in tr.find_all(["td", "th"], recursive=False):
                while (r, c) in grid:
                    c += 1
                rs, cs = int(td.get("rowspan", 1) or 1), int(td.get("colspan", 1) or 1)
                for i in range(rs):
                    for j in range(cs):
                        grid[(r + i, c + j)] = td
                pos[id(td)] = c
                if header_row in (None, r):
                    label = clean(td.get_text())
                    if day_re.match(label):
                        header_row = r
                        for j in range(cs):
                            day_cols[c + j] = label
                c += cs
        items = []
        for td in table.select("td.appointment"):
            day = day_cols.get(pos.get(id(td), -1))
            text = clean(td.get_text(" "))
            m = re.search(r"(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})", text)
            links = td.find_all("a")
            course = links[-1] if links else None
            name = clean(course.get("title") or course.get_text()) if course else text
            rooms = ", ".join(clean(a.get_text()) for a in links[:-1])
            if not rooms:
                rooms = clean(text.replace(m.group(0) if m else "", "").replace(clean(course.get_text()) if course else "", ""))
            items.append({"day": day or "?", "start": m.group(1) if m else "", "end": m.group(2) if m else "",
                          "course": name, "room": rooms,
                          "url": urljoin(BASE, course["href"]) if course and course.get("href") else ""})
        order = list(dict.fromkeys(day_cols.values()))
        items.sort(key=lambda it: (order.index(it["day"]) if it["day"] in order else 99, it["start"].zfill(5)))
        return title, items

    def follow_arrow(self, soup: BeautifulSoup, direction: str) -> BeautifulSoup:
        a = soup.select_one(f"#pageContent a.img_arrow{direction}")
        if not a or not a.get("href"):
            raise TucanError("No navigation arrow on this page.")
        return self.get(a["href"])
