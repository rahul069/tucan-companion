# Privacy policy – TUCaN Companion

_Last updated: 21 October 2026_

TUCaN Companion is a browser extension that changes how TU Darmstadt's TUCaN pages look in your own browser.

## What the extension collects

**Nothing.** The extension doesn't collect, transmit, sell or share any personal data, and contains no analytics or tracking. The only network requests it makes go to TUCaN itself (`www.tucan.tu-darmstadt.de`), using your existing login: on the performance record page it reads *My Modules*, *My Current Registrations*, *Module Results*, *Examination Results* and the *Registration* overview to calculate your degree progress.

## What it stores on your device

Using Chrome's local extension storage (`chrome.storage.local` and the page's `localStorage`/`sessionStorage`), only on your computer:

- **View preferences**, such as whether the schedule shows *Agenda* or *Grid*.
- **A short-lived copy of your module list** (codes, names, credits, and which area offers them) for the degree-progress view, refreshed every 6–12 hours (the area list weekly).
- **Your sign-in key**, only if you add one in the popup, so the extension can show and fill your TU one-time code. It never leaves your browser. You can delete it any time with **Remove key** in the popup, or by removing the extension.

## Optional: TUPlan grade averages

Off by default. If you turn on **"Grade averages from TUPlan"** in the popup:

- The extension downloads TUPlan's public grade list from `https://www.tuplan.courses` about once a day. This request carries no data about you (no cookies, no identifiers).
- On a grade statistics page you can click **Share distribution**. Only then, the anonymous table shown on that page is sent to TUPlan: module number, title, semester, number of students per grade, average, and the counts of missing results. Your name, matriculation number and your own grade are never sent.
- TUPlan's own privacy policy applies to data you share with it: https://www.tuplan.courses/en/privacy

## Where it runs

Only on `https://www.tucan.tu-darmstadt.de/*` (theme, translations), `https://dsf.tucan.tu-darmstadt.de/*` (dark theme for TUCaN's logout and applicant login pages) and `https://login.tu-darmstadt.de/*` (filling the one-time code). The page content it reads there (e.g. your schedule) is processed locally to change the layout and isn't stored or sent anywhere.

## Permissions

- `storage`: remember the preferences and the optional sign-in key described above.
- `clipboardWrite`: copy the current code when you click it in the popup.

## The optional MCP server

The separate tool in `mcp/` is not part of the browser extension. It runs on your computer only if you install it, and stores your TU login in your operating system's keyring. What it reads is passed to the AI assistant you connect it to.

## Contact

Questions: open an issue at https://github.com/rahul069/tucan-companion/issues
