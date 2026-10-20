# Chrome Web Store listing

**Name:** TUCaN Companion – Dark Mode, Schedule & Sign-in Codes

**Summary (max 132 chars):**
Dark theme, clearer schedule, exams and grades, English translations and automatic sign-in codes for TU Darmstadt's TUCaN.

**Category:** Education · **Language:** English

**Description:**

TUCaN Companion makes TU Darmstadt's TUCaN easier to use.

• Dark theme with a clean two-row header on every page
• Weekly schedule as an agenda (with "next class") or the classic grid, plus week picker and keyboard navigation
• Month view as a real calendar with full course names
• Exams, module results and performance record: status colours (passed, incomplete, failed) and clearer layout
• Degree progress: credits counted vs. required, what's missing per area, and where this semester's modules will count
• Grade statistics: participants, average, pass rate and distribution chart
• Registration: breadcrumb, area and course cards, deadline countdowns, clear Register/Deregister buttons
• English translations for German leftovers (original text on hover)
• Sign-in codes: shows your TU one-time code in the toolbar and fills it in on the TU login page (optional)

Privacy: no data collection, no tracking. The only requests go to TUCaN itself, with your login, to read your module lists for the progress view.

Unofficial student project, not affiliated with TU Darmstadt. Open source: https://github.com/rahul069/tucan-companion

**Single purpose:** Improve the usability and appearance of TU Darmstadt's TUCaN student portal (including filling the one-time code on its login page).

**Permission justifications:**
- `storage`: saves the user's view preferences and, optionally, the TOTP key they enter, locally.
- `clipboardWrite`: copies the one-time code when the user clicks it in the popup.
- Host access `www.tucan.tu-darmstadt.de`: restyles and translates TUCaN pages.
- Host access `dsf.tucan.tu-darmstadt.de`: dark styling for TUCaN's logout/login pages (CSS only).
- Host access `login.tu-darmstadt.de`: fills the one-time code on the TU login page.

**Remote code:** No. All code is included in the package.

**Data usage:** Doesn't collect or transmit user data to the developer or third parties. Reads the user's own TUCaN pages (same site, user's session) to calculate degree progress; caches module lists locally. The optional TOTP key is stored locally only.

**Privacy policy URL:** https://github.com/rahul069/tucan-companion/blob/main/PRIVACY.md

**Screenshots (1280×800):** `store/screenshots/`
