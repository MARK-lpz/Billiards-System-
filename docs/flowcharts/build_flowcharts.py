"""Builds the employee-side flowcharts in docs/flowcharts as PNG images.

Each chart follows the classic style: green Start/End, yellow Yes/No
decisions, blue steps, black right-angle arrows. Needs Graphviz (`dot`).

    python docs/flowcharts/build_flowcharts.py
"""
import pathlib
import subprocess

HERE = pathlib.Path(__file__).parent

STYLES = {
    "term": 'shape=box, style="rounded,filled", fillcolor="#adff2f", width=1.8, height=0.6',
    "dec": 'shape=diamond, style=filled, fillcolor="#ffd700", width=2.4, height=1.4',
    "proc": 'shape=box, style=filled, fillcolor="#00bfff", width=2.2, height=0.8',
}

# Each chart: nodes as (id, kind, label), edges as (from, to, label).
# Nodes listed in "main" are kept in one straight column, like the example.
CHARTS = {
    "1-login": {
        "title": "Employee Login",
        "main": ["S", "A", "B", "C", "E", "G", "H", "I", "Z"],
        "nodes": [
            ("S", "term", "Start"),
            ("A", "proc", "Open staff app"),
            ("B", "proc", "Enter username\nand password"),
            ("C", "dec", "Credentials\nvalid?"),
            ("D", "proc", "Show error\nmessage"),
            ("E", "dec", "Employee\naccount?"),
            ("F", "proc", "Open Admin\nDashboard"),
            ("G", "proc", "Open Employee\nPanel"),
            ("H", "proc", "Choose a page\nfrom the sidebar"),
            ("I", "dec", "Log out?"),
            ("Z", "term", "End"),
        ],
        "edges": [
            ("S", "A", ""), ("A", "B", ""), ("B", "C", ""),
            ("C", "D", "No"), ("D", "B", ""),
            ("C", "E", "Yes"),
            ("E", "F", "No"), ("F", "Z", ""),
            ("E", "G", "Yes"), ("G", "H", ""), ("H", "I", ""),
            ("I", "H", "No"), ("I", "Z", "Yes"),
        ],
    },
    "2-pool-tables": {
        "title": "Pool Tables",
        "main": ["S", "A", "B", "C", "F", "G", "K", "N", "O", "Z"],
        "nodes": [
            ("S", "term", "Start"),
            ("A", "proc", "Open Pool Tables"),
            ("B", "proc", "Select a table"),
            ("C", "dec", "Table\navailable?"),
            ("D", "proc", "Enter customer\nname and hours"),
            ("E", "proc", "Start walk-in\nsession"),
            ("F", "dec", "Table\nreserved?"),
            ("H", "dec", "Guest arrived\non time?"),
            ("I", "proc", "Cancel\nreservation"),
            ("J", "proc", "Check in guest"),
            ("G", "proc", "Session running"),
            ("K", "dec", "Add more\ntime?"),
            ("L", "dec", "Clashes with\nnext booking?"),
            ("M", "proc", "Add time"),
            ("N", "proc", "End session"),
            ("O", "proc", "Send table bill\nto Sales POS"),
            ("Z", "term", "End"),
        ],
        "edges": [
            ("S", "A", ""), ("A", "B", ""), ("B", "C", ""),
            ("C", "D", "Yes"), ("D", "E", ""), ("E", "G", ""),
            ("C", "F", "No"), ("F", "G", "No"),
            ("F", "H", "Yes"), ("H", "J", "Yes"), ("J", "G", ""),
            ("H", "I", "No"), ("I", "Z", ""),
            ("G", "K", ""), ("K", "L", "Yes"),
            ("L", "M", "No"), ("M", "G", ""),
            ("L", "N", "Yes"), ("K", "N", "No"),
            ("N", "O", ""), ("O", "Z", ""),
        ],
    },
    "3-sales-pos": {
        "title": "Sales POS",
        "main": ["S", "A", "B", "C", "D", "F", "G", "H", "I", "L", "M", "Z"],
        "nodes": [
            ("S", "term", "Start"),
            ("A", "proc", "Open Sales POS"),
            ("B", "proc", "Open or select\na bill"),
            ("C", "proc", "Pick a product or\ntable charge"),
            ("D", "dec", "In stock?"),
            ("E", "proc", "Show out of\nstock message"),
            ("F", "proc", "Add to cart"),
            ("G", "dec", "More items?"),
            ("H", "proc", "Send order\nto queue"),
            ("I", "dec", "Pay with\nGCash?"),
            ("J", "proc", "Enter GCash\nreference"),
            ("K", "proc", "Receive cash"),
            ("L", "proc", "Confirm payment"),
            ("M", "proc", "Print receipt"),
            ("Z", "term", "End"),
        ],
        "edges": [
            ("S", "A", ""), ("A", "B", ""), ("B", "C", ""), ("C", "D", ""),
            ("D", "E", "No"), ("E", "C", ""),
            ("D", "F", "Yes"), ("F", "G", ""),
            ("G", "C", "Yes"), ("G", "H", "No"),
            ("H", "I", ""), ("I", "J", "Yes"), ("I", "K", "No"),
            ("J", "L", ""), ("K", "L", ""), ("L", "M", ""), ("M", "Z", ""),
        ],
    },
    "4-reservations": {
        "title": "Reservations Desk",
        "main": ["S", "A", "B", "C", "D", "F", "J", "L", "M", "N", "O", "Z"],
        "nodes": [
            ("S", "term", "Start"),
            ("A", "proc", "Open Reservations"),
            ("B", "dec", "Online\nbooking?"),
            ("C", "proc", "Check GCash\npayment"),
            ("D", "dec", "Payment\nfound?"),
            ("E", "proc", "Reject booking"),
            ("G", "proc", "Enter booking\ndetails"),
            ("H", "dec", "Table free at\nthat time?"),
            ("I", "proc", "Choose another\ntable or time"),
            ("F", "proc", "Approve booking"),
            ("J", "dec", "Guest\narrived?"),
            ("K", "proc", "Cancel or expire\nbooking"),
            ("L", "proc", "Mark arrived"),
            ("M", "proc", "Assign table"),
            ("N", "proc", "Complete booking"),
            ("O", "proc", "Send table bill\nto Sales POS"),
            ("Z", "term", "End"),
        ],
        "edges": [
            ("S", "A", ""), ("A", "B", ""),
            ("B", "C", "Yes"), ("C", "D", ""),
            ("D", "E", "No"), ("E", "Z", ""),
            ("D", "F", "Yes"),
            ("B", "G", "No"), ("G", "H", ""),
            ("H", "I", "No"), ("I", "G", ""),
            ("H", "F", "Yes"),
            ("F", "J", ""), ("J", "K", "No"), ("K", "Z", ""),
            ("J", "L", "Yes"), ("L", "M", ""), ("M", "N", ""),
            ("N", "O", ""), ("O", "Z", ""),
        ],
    },
    "5-actions": {
        "title": "Actions",
        "main": ["S", "A", "B", "G", "K", "Z"],
        "same_rank": [["B", "C"], ["G", "H"], ["K", "L"]],
        "nodes": [
            ("S", "term", "Start"),
            ("A", "proc", "Open Actions"),
            ("B", "dec", "Problem with\ntable or\nequipment?"),
            ("C", "proc", "Fill in\nissue report"),
            ("D", "dec", "Table can't\nbe used?"),
            ("E", "proc", "Set table under\nmaintenance"),
            ("F", "proc", "Send report\nto admin"),
            ("G", "dec", "Change table\nstatus?"),
            ("H", "dec", "Table in play\nor reserved?"),
            ("I", "proc", "End session or\nbooking first"),
            ("J", "proc", "Set Cleaning,\nMaintenance\nor Ready"),
            ("K", "dec", "Lend spare\nequipment?"),
            ("L", "proc", "Log borrowed\nitem"),
            ("M", "dec", "Returned\ndamaged?"),
            ("N", "proc", "Report damaged\nitem"),
            ("O", "proc", "Mark as returned"),
            ("Z", "term", "End"),
        ],
        "edges": [
            ("S", "A", ""), ("A", "B", ""),
            ("B", "C", "Yes"), ("C", "D", ""),
            ("D", "E", "Yes"), ("E", "F", ""), ("D", "F", "No"), ("F", "Z", ""),
            ("B", "G", "No"),
            ("G", "H", "Yes"), ("H", "I", "Yes"), ("H", "J", "No"),
            ("I", "Z", ""), ("J", "Z", ""),
            ("G", "K", "No"),
            ("K", "L", "Yes"), ("L", "M", ""),
            ("M", "N", "Yes"), ("M", "O", "No"),
            ("N", "Z", ""), ("O", "Z", ""),
            ("K", "Z", "No"),
        ],
    },
    "6-tournaments": {
        "title": "Tournament Schedule",
        "main": ["S", "A", "B", "C", "E", "F", "G", "I", "Z"],
        "same_rank": [["G", "H"], ["I", "D"]],
        "nodes": [
            ("S", "term", "Start"),
            ("A", "proc", "Open Tournament\nSchedule"),
            ("B", "proc", "Select a\ntournament"),
            ("C", "dec", "Open for\nregistration?"),
            ("D", "proc", "View details only"),
            ("E", "dec", "Register a\nwalk-in player?"),
            ("F", "proc", "Enter player\ndetails"),
            ("G", "dec", "Already\nregistered?"),
            ("H", "proc", "Show error\nmessage"),
            ("I", "proc", "Add player to\nparticipants"),
            ("Z", "term", "End"),
        ],
        "edges": [
            ("S", "A", ""), ("A", "B", ""), ("B", "C", ""),
            ("C", "D", "No"), ("C", "E", "Yes"),
            ("E", "D", "No"), ("E", "F", "Yes"), ("F", "G", ""),
            ("G", "H", "Yes"), ("H", "F", ""),
            ("G", "I", "No"), ("I", "Z", ""), ("D", "Z", ""),
        ],
    },
}


def to_dot(chart):
    main = chart["main"]
    lines = [
        "digraph G {",
        '  graph [splines=ortho, nodesep=0.8, ranksep=0.55, pad=0.4, bgcolor=white, dpi=150];',
        '  node [fontname="Arial", fontsize=14, color=black, penwidth=2, fixedsize=true];',
        '  edge [fontname="Arial", fontsize=15, color=black, penwidth=2, arrowsize=1.1];',
    ]
    for node_id, kind, label in chart["nodes"]:
        group = ', group=main' if node_id in main else ""
        lines.append(f'  {node_id} [label="{label}", {STYLES[kind]}{group}];')
    for src, dst, label in chart["edges"]:
        attrs = []
        if label:
            attrs.append(f'xlabel=" {label} "')
        # Steps along the main column pull hardest, so that column stays straight.
        if src in main and dst in main:
            attrs.append("weight=10")
        lines.append(f'  {src} -> {dst} [{", ".join(attrs)}];')
    for row in chart.get("same_rank", []):
        lines.append(f'  {{rank=same; {"; ".join(row)}}}')
    lines.append("}")
    return "\n".join(lines)


def main():
    for name, chart in CHARTS.items():
        dot = to_dot(chart)
        subprocess.run(["dot", "-Tpng", "-o", str(HERE / f"{name}.png")], input=dot.encode(), check=True)
        print(f"built {name}.png")


if __name__ == "__main__":
    main()
