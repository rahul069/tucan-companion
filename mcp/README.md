# tucan-mcp

Read-only MCP server for TU Darmstadt's TUCaN. It logs in through the TU SSO (TU-ID, password, TOTP code), then reads your pages.

## Setup

```bash
cd tucan-companion/mcp
uv run tucan-mcp-setup          # asks for TU-ID, password, TOTP key; tests the login
claude mcp add tucan -s user -- uv run --directory /path/to/tucan-companion/mcp tucan-mcp
```

- `uv run tucan-mcp-setup --test` re-tests the saved login.
- `uv run tucan-mcp-setup --forget` deletes the saved login and session.

Credentials live in the system keyring (service `tucan-mcp`). The TUCaN session (cookies) is cached in `~/.cache/tucan-mcp/state.json` (mode 600), so restarts don't need a new login.

## Tools

`tucan_overview`, `tucan_schedule(week_offset)`, `tucan_month(month_offset)`, `tucan_exams(semester)`, `tucan_module_results(semester)`, `tucan_exam_results(semester)`, `tucan_performance_record`, `tucan_my_modules(semester)`, `tucan_my_courses(semester)`, `tucan_registrations`, `tucan_registration_offers`, `tucan_messages`, `tucan_menu`, `tucan_open(name, semester)`, `tucan_follow(link)`.

Pages are returned as text with numbered links (`Deep Learning [4]`), and `tucan_follow(4)` opens one of them.

## Read-only

After login the client only sends GET requests to TUCaN, plus the semester dropdown forms. Links for register, deregister, cancel, log out, language switch and document creation are never numbered, so they can't be followed.
