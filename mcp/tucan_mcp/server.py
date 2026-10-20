"""MCP server exposing a read-only view of TUCaN (TU Darmstadt)."""

import re

from mcp.server.mcpserver import MCPServer

from .client import Tucan, TucanError, clean

mcp = MCPServer(
    "tucan",
    instructions=(
        "Read-only access to the user's TUCaN account at TU Darmstadt: schedule, exams, grades, "
        "modules, registrations and messages. Pages come back as text; links are numbered like "
        "'Deep Learning [4]' and can be opened with tucan_follow(4). Nothing can be registered, "
        "cancelled or changed through these tools."
    ),
)
tucan = Tucan()


def page(prg: str | None = None, text: str | None = None, semester: str | None = None) -> str:
    try:
        soup = tucan.get(tucan.menu_url(prg=prg, text=text))
        if semester:
            soup = tucan.submit_filter(soup, semester)
        return tucan.to_text(soup)
    except TucanError as e:
        return f"Error: {e}"


@mcp.tool()
def tucan_overview() -> str:
    """Start page: today's appointments and the newest messages."""
    return page(prg="MLSSTART")


@mcp.tool()
def tucan_schedule(week_offset: int = 0) -> str:
    """Classes for a week as a list per day. week_offset: 0 = this week, 1 = next week, -1 = last week."""
    try:
        soup = tucan.get(tucan.menu_url(text=r"Week|Woche"))
        for _ in range(abs(week_offset)):
            soup = tucan.follow_arrow(soup, "Right" if week_offset > 0 else "Left")
        title, items = tucan.week_appointments(soup)
    except TucanError as e:
        return f"Error: {e}"
    if not items:
        return f"{title or 'This week'}: no appointments."
    out, day = [title], None
    for it in items:
        if it["day"] != day:
            day = it["day"]
            out.append(f"\n{day}")
        out.append(f"- {it['start']}–{it['end']} {it['course']}" + (f" ({it['room']})" if it["room"] else ""))
    return "\n".join(out)


@mcp.tool()
def tucan_month(month_offset: int = 0) -> str:
    """Month calendar with all appointments. month_offset: 0 = this month, 1 = next month, ..."""
    try:
        soup = tucan.get(tucan.menu_url(prg="MONTH"))
        for _ in range(abs(month_offset)):
            soup = tucan.follow_arrow(soup, "Right" if month_offset > 0 else "Left")
        return tucan.to_text(soup)
    except TucanError as e:
        return f"Error: {e}"


@mcp.tool()
def tucan_exams(semester: str | None = None) -> str:
    """Exams you're registered for, with dates and rooms. semester e.g. 'WiSe 2026/27' (default: current)."""
    return page(prg="MYEXAMS", semester=semester)


@mcp.tool()
def tucan_module_results(semester: str | None = None) -> str:
    """Module grades and credits for one semester, e.g. 'SoSe 2026' (default: current)."""
    return page(prg="COURSERESULTS", semester=semester)


@mcp.tool()
def tucan_exam_results(semester: str | None = None) -> str:
    """Individual exam results for one semester, e.g. 'SoSe 2026' (default: current)."""
    return page(prg="EXAMRESULTS", semester=semester)


@mcp.tool()
def tucan_performance_record() -> str:
    """Full performance record (Leistungsspiegel): all modules, grades, credits and the average."""
    return page(prg="STUDENT_RESULT")


@mcp.tool()
def tucan_my_modules(semester: str | None = None) -> str:
    """Modules you're enrolled in for a semester."""
    return page(prg="MYMODULES", semester=semester)


@mcp.tool()
def tucan_my_courses(semester: str | None = None) -> str:
    """Courses (lectures, exercises) you're enrolled in for a semester."""
    return page(prg="PROFCOURSES", semester=semester)


@mcp.tool()
def tucan_registrations() -> str:
    """Your current module/course registrations."""
    return page(prg="MYREGISTRATIONS")


@mcp.tool()
def tucan_registration_offers() -> str:
    """Entry point of the registration area (programmes and areas). Drill down with tucan_follow."""
    return page(prg="REGISTRATION")


@mcp.tool()
def tucan_messages() -> str:
    """Inbox. Open a message with tucan_follow(n)."""
    return page(text=r"Messages|Nachrichten")


@mcp.tool()
def tucan_menu() -> str:
    """All TUCaN menu entries; open any of them with tucan_open(name)."""
    try:
        if not tucan.menu:
            tucan.login()
    except TucanError as e:
        return f"Error: {e}"
    return "\n".join("  " * (m["depth"] - 1) + "- " + m["text"] for m in tucan.menu if not re.match(r"(Winter|Summer) Term \d{4}", m["text"]))


@mcp.tool()
def tucan_open(name: str, semester: str | None = None) -> str:
    """Open a TUCaN menu entry by its name as listed by tucan_menu (e.g. 'My Examination Schedule')."""
    try:
        if not tucan.menu:
            tucan.login()
    except TucanError as e:
        return f"Error: {e}"
    wanted = clean(name).lower()
    match = next((m for m in tucan.menu if m["text"].lower() == wanted), None) or \
        next((m for m in tucan.menu if wanted in m["text"].lower()), None)
    if not match:
        return "No such menu entry. Use tucan_menu to see the names."
    return page(text=re.escape(match["text"]), semester=semester)


@mcp.tool()
def tucan_follow(link: int) -> str:
    """Open link number `link` from the page returned by the previous tucan_* call (e.g. a module or message)."""
    url = tucan.links.get(link)
    if not url:
        return "Unknown link number - open a page first and use one of its [n] numbers."
    try:
        return tucan.to_text(tucan.get(url))
    except TucanError as e:
        return f"Error: {e}"


def main():
    mcp.run()


if __name__ == "__main__":
    main()
