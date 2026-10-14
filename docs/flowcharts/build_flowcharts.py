"""Builds the employee-side system flowchart in docs/flowcharts as PNG pages.

Black-and-white system flowchart: rounded START/END, parallelograms for pages
and input, diamonds for YES/NO decisions, boxes for processes. Pages link
through lettered off-page connectors (A, B, ...). Needs Graphviz (`dot`).

    python docs/flowcharts/build_flowcharts.py
"""
import pathlib
import subprocess

HERE = pathlib.Path(__file__).parent

STYLES = {
    "term": 'shape=box, style="rounded", width=1.1, height=0.4',
    "proc": 'shape=box, width=2.4, height=0.55',
    "io": 'shape=parallelogram, width=2.6, height=0.55',
    "dec": 'shape=diamond, width=2.2, height=1.3',
    # On-page connector: joins two points of the same page without a long line.
    "circ": 'shape=circle, width=0.4, height=0.4, fontsize=10',
    # Off-page connector leaving this page, and the one a page starts from.
    "off": 'shape=invhouse, width=0.45, height=0.4, fontsize=10',
    "offin": 'shape=invhouse, style=filled, fillcolor="#3a3a3a", fontcolor=white, width=0.45, height=0.4, fontsize=10',
}

# Each page: nodes as (id, kind, label), edges as (from, to, label).
# "main" nodes stay in one straight column; "same_rank" rows sit side by side.
PAGES = {
    "1-login": {
        "main": ["S", "A", "B", "C", "D", "X"],
        "same_rank": [["C", "N"]],
        "nodes": [
            ("S", "term", "START"),
            ("A", "io", "LOGIN PAGE"),
            ("B", "io", "INPUT USERNAME\nAND PASSWORD"),
            ("C", "dec", "CORRECT\nEMPLOYEE\nCREDENTIALS?"),
            ("D", "proc", "REDIRECT TO\nEMPLOYEE DASHBOARD"),
            ("X", "off", "A"),
            ("N", "dec", "DO YOU WANT\nTO TRY AGAIN?"),
            ("F", "dec", "FORGOT\nPASSWORD?"),
            ("R", "proc", "REQUEST PASSWORD\nRESET FROM ADMIN"),
            ("Z1", "term", "END"),
            ("Z2", "term", "END"),
        ],
        "edges": [
            ("S", "A", ""), ("A", "B", ""), ("B", "C", ""),
            ("C", "D", "YES"), ("D", "X", ""),
            ("C", "N", "NO"), ("N", "A", "YES"), ("N", "F", "NO"),
            ("F", "R", "YES"), ("R", "Z1", ""), ("F", "Z2", "NO"),
        ],
    },
    "2-dashboard": {
        "main": ["IN", "A", "B", "P3", "C3"],
        "same_rank": [["A", "L", "LO"], ["B", "Z"]],
        "nodes": [
            ("IN", "offin", "A"),
            ("A", "dec", "DO YOU WANT\nTO STAY AND\nUSE THE SYSTEM?"),
            ("L", "dec", "DO YOU WANT\nTO LOG OUT?"),
            ("LO", "proc", "LOG OUT"),
            ("Z", "term", "END"),
            ("B", "proc", "SELECT PAGE FROM\nTHE SIDEBAR"),
            ("P1", "io", "POOL TABLES"),
            ("P2", "io", "SALES POS"),
            ("P3", "io", "RESERVATIONS"),
            ("P4", "io", "ACTIONS"),
            ("P5", "io", "TOURNAMENT\nSCHEDULE"),
            ("C1", "off", "B"),
            ("C2", "off", "C"),
            ("C3", "off", "D"),
            ("C4", "off", "E"),
            ("C5", "off", "F"),
        ],
        "edges": [
            ("IN", "A", ""),
            ("A", "B", "YES"), ("A", "L", "NO"),
            ("L", "LO", "YES"), ("L", "A", "NO"), ("LO", "Z", ""),
            ("B", "P1", ""), ("B", "P2", ""), ("B", "P3", ""), ("B", "P4", ""), ("B", "P5", ""),
            ("P1", "C1", ""), ("P2", "C2", ""), ("P3", "C3", ""), ("P4", "C4", ""), ("P5", "C5", ""),
        ],
    },
    "3-pool-tables": {
        "main": ["IN", "A", "B", "C", "D", "E", "G", "K", "N", "O", "Z1"],
        "same_rank": [["C", "F"], ["K", "L"]],
        "nodes": [
            ("IN", "offin", "B"),
            ("A", "io", "POOL TABLES PAGE"),
            ("B", "proc", "SELECT A TABLE"),
            ("C", "dec", "TABLE\nAVAILABLE?"),
            ("D", "io", "INPUT CUSTOMER\nNAME AND HOURS"),
            ("E", "proc", "START WALK-IN\nSESSION"),
            ("F", "dec", "TABLE\nRESERVED?"),
            ("H", "dec", "GUEST ARRIVED\nON TIME?"),
            ("I", "proc", "CANCEL\nRESERVATION"),
            ("J", "proc", "CHECK IN GUEST"),
            ("G", "proc", "SESSION RUNNING"),
            ("K", "dec", "ADD MORE\nTIME?"),
            ("L", "dec", "CONFLICTS WITH\nNEXT BOOKING?"),
            ("M", "proc", "ADD TIME"),
            ("N", "proc", "END SESSION"),
            ("O", "proc", "SEND TABLE BILL\nTO SALES POS"),
            ("Z1", "term", "END"),
            ("Z2", "term", "END"),
        ],
        "edges": [
            ("IN", "A", ""), ("A", "B", ""), ("B", "C", ""),
            ("C", "D", "YES"), ("D", "E", ""), ("E", "G", ""),
            ("C", "F", "NO"), ("F", "H", "YES"), ("F", "G", "NO"),
            ("H", "J", "YES"), ("J", "G", ""),
            ("H", "I", "NO"), ("I", "Z2", ""),
            ("G", "K", ""), ("K", "L", "YES"), ("K", "N", "NO"),
            ("L", "M", "NO"), ("M", "G", ""), ("L", "N", "YES"),
            ("N", "O", ""), ("O", "Z1", ""),
        ],
    },
    "4-sales-pos": {
        "main": ["IN", "A", "B", "C", "D", "F", "G", "H", "I", "K", "L", "M", "P", "Z1"],
        "same_rank": [["C", "R2"], ["D", "E"], ["G", "R1"], ["I", "J"], ["L", "Q"]],
        "nodes": [
            ("IN", "offin", "C"),
            ("A", "io", "SALES POS PAGE"),
            ("B", "proc", "OPEN OR SELECT\nA BILL"),
            ("C", "io", "SELECT PRODUCT OR\nTABLE CHARGE"),
            ("D", "dec", "ITEM IN\nSTOCK?"),
            ("E", "proc", "DISPLAY OUT OF\nSTOCK MESSAGE"),
            ("F", "proc", "ADD TO CART"),
            ("G", "dec", "ADD MORE\nITEMS?"),
            ("H", "proc", "SEND ORDER\nTO QUEUE"),
            ("I", "dec", "PAY THROUGH\nGCASH?"),
            ("J", "io", "INPUT GCASH\nREFERENCE NO."),
            ("K", "proc", "RECEIVE CASH\nPAYMENT"),
            ("L", "dec", "CONFIRM\nPAYMENT?"),
            ("Q", "proc", "CANCEL"),
            ("M", "proc", "SAVE TRANSACTION"),
            ("P", "io", "PRINT RECEIPT"),
            ("R1", "circ", "1"),
            ("R2", "circ", "1"),
            ("Z1", "term", "END"),
            ("Z2", "term", "END"),
        ],
        "edges": [
            ("IN", "A", ""), ("A", "B", ""), ("B", "C", ""), ("C", "D", ""),
            ("D", "E", "NO"), ("E", "G", ""),
            ("D", "F", "YES"), ("F", "G", ""),
            ("G", "R1", "YES"), ("R2", "C", ""), ("G", "H", "NO"),
            ("H", "I", ""), ("I", "J", "YES"), ("I", "K", "NO"),
            ("J", "L", ""), ("K", "L", ""),
            ("L", "Q", "NO"), ("Q", "Z2", ""),
            ("L", "M", "YES"), ("M", "P", ""), ("P", "Z1", ""),
        ],
    },
    "5-reservations": {
        "main": ["IN", "A", "B", "C", "D", "F", "J", "L", "M", "N", "O", "Z1"],
        "same_rank": [["D", "E"], ["J", "K"]],
        "nodes": [
            ("IN", "offin", "D"),
            ("A", "io", "RESERVATION DESK PAGE"),
            ("B", "dec", "NEW ONLINE\nBOOKING?"),
            ("C", "proc", "CHECK GCASH\nPAYMENT"),
            ("D", "dec", "PAYMENT\nFOUND?"),
            ("E", "proc", "REJECT BOOKING"),
            ("G", "dec", "ADD BOOKING\nAT THE DESK?"),
            ("H", "io", "INPUT BOOKING\nDETAILS"),
            ("I", "dec", "TABLE FREE AT\nTHAT TIME?"),
            ("F", "proc", "APPROVE BOOKING"),
            ("J", "dec", "GUEST\nARRIVED?"),
            ("K", "proc", "CANCEL OR EXPIRE\nBOOKING"),
            ("L", "proc", "MARK AS ARRIVED"),
            ("M", "proc", "ASSIGN TABLE"),
            ("N", "proc", "COMPLETE BOOKING"),
            ("O", "proc", "SEND TABLE BILL\nTO SALES POS"),
            ("Z1", "term", "END"),
            ("Z2", "term", "END"),
            ("Z3", "term", "END"),
            ("Z4", "term", "END"),
        ],
        "edges": [
            ("IN", "A", ""), ("A", "B", ""),
            ("B", "C", "YES"), ("C", "D", ""),
            ("D", "E", "NO"), ("E", "Z2", ""),
            ("D", "F", "YES"),
            ("B", "G", "NO"), ("G", "Z3", "NO"),
            ("G", "H", "YES"), ("H", "I", ""),
            ("I", "H", "NO"), ("I", "F", "YES"),
            ("F", "J", ""), ("J", "K", "NO"), ("K", "Z4", ""),
            ("J", "L", "YES"), ("L", "M", ""), ("M", "N", ""),
            ("N", "O", ""), ("O", "Z1", ""),
        ],
    },
    "6-actions": {
        "main": ["IN", "A", "B", "G", "K", "Z1"],
        "same_rank": [["B", "C"], ["G", "H"], ["K", "L"]],
        "nodes": [
            ("IN", "offin", "E"),
            ("A", "io", "ACTIONS PAGE"),
            ("B", "dec", "REPORT AN\nISSUE?"),
            ("C", "io", "INPUT ISSUE\nDETAILS"),
            ("D", "dec", "TABLE CANNOT\nBE USED?"),
            ("E", "proc", "SET TABLE UNDER\nMAINTENANCE"),
            ("F", "proc", "SEND REPORT\nTO ADMIN"),
            ("G", "dec", "CHANGE TABLE\nSTATUS?"),
            ("H", "dec", "TABLE IN PLAY\nOR RESERVED?"),
            ("I", "proc", "END SESSION OR\nBOOKING FIRST"),
            ("J", "proc", "SET CLEANING,\nMAINTENANCE OR READY"),
            ("K", "dec", "LEND SPARE\nEQUIPMENT?"),
            ("L", "io", "LOG BORROWED\nITEM"),
            ("M", "dec", "RETURNED\nDAMAGED?"),
            ("N", "proc", "REPORT DAMAGED\nITEM"),
            ("O", "proc", "MARK AS RETURNED"),
            ("Z1", "term", "END"),
            ("Z2", "term", "END"),
            ("Z3", "term", "END"),
            ("Z4", "term", "END"),
        ],
        "edges": [
            ("IN", "A", ""), ("A", "B", ""),
            ("B", "C", "YES"), ("C", "D", ""),
            ("D", "E", "YES"), ("E", "F", ""), ("D", "F", "NO"), ("F", "Z2", ""),
            ("B", "G", "NO"),
            ("G", "H", "YES"), ("H", "I", "YES"), ("H", "J", "NO"),
            ("I", "Z3", ""), ("J", "Z3", ""),
            ("G", "K", "NO"),
            ("K", "L", "YES"), ("L", "M", ""),
            ("M", "N", "YES"), ("M", "O", "NO"),
            ("N", "Z4", ""), ("O", "Z4", ""),
            ("K", "Z1", "NO"),
        ],
    },
    "7-tournaments": {
        "main": ["IN", "A", "B", "C", "E", "F", "G", "I", "Z1"],
        "same_rank": [["C", "D"], ["G", "H"]],
        "nodes": [
            ("IN", "offin", "F"),
            ("A", "io", "TOURNAMENT\nSCHEDULE PAGE"),
            ("B", "proc", "SELECT A\nTOURNAMENT"),
            ("C", "dec", "OPEN FOR\nREGISTRATION?"),
            ("D", "proc", "VIEW DETAILS ONLY"),
            ("E", "dec", "REGISTER A\nWALK-IN PLAYER?"),
            ("F", "io", "INPUT PLAYER\nDETAILS"),
            ("G", "dec", "ALREADY\nREGISTERED?"),
            ("H", "proc", "DISPLAY ERROR\nMESSAGE"),
            ("I", "proc", "SUBMIT"),
            ("Z1", "term", "END"),
            ("Z2", "term", "END"),
            ("Z3", "term", "END"),
            ("Z4", "term", "END"),
        ],
        "edges": [
            ("IN", "A", ""), ("A", "B", ""), ("B", "C", ""),
            ("C", "D", "NO"), ("D", "Z2", ""),
            ("C", "E", "YES"), ("E", "Z3", "NO"),
            ("E", "F", "YES"), ("F", "G", ""),
            ("G", "H", "YES"), ("H", "Z4", ""),
            ("G", "I", "NO"), ("I", "Z1", ""),
        ],
    },
}


def to_dot(page):
    main = page["main"]
    lines = [
        "digraph G {",
        '  graph [splines=ortho, nodesep=0.6, ranksep=0.45, pad=0.5, bgcolor=white, dpi=150];',
        '  node [fontname="Arial", fontsize=11, color=black, penwidth=1.3, fixedsize=true];',
        '  edge [fontname="Arial", fontsize=11, color=black, penwidth=1.3, arrowsize=0.7];',
    ]
    for node_id, kind, label in page["nodes"]:
        group = ", group=main" if node_id in main else ""
        lines.append(f'  {node_id} [label="{label}", {STYLES[kind]}{group}];')
    for src, dst, label in page["edges"]:
        attrs = []
        if label:
            attrs.append(f'xlabel=" {label} "')
        # Steps along the main column pull hardest, so that column stays straight.
        if src in main and dst in main:
            attrs.append("weight=10")
        lines.append(f'  {src} -> {dst} [{", ".join(attrs)}];')
    for row in page.get("same_rank", []):
        lines.append(f'  {{rank=same; {"; ".join(row)}}}')
    lines.append("}")
    return "\n".join(lines)


def main():
    for old in HERE.glob("*.png"):
        old.unlink()
    for name, page in PAGES.items():
        dot = to_dot(page)
        subprocess.run(["dot", "-Tpng", "-o", str(HERE / f"{name}.png")], input=dot.encode(), check=True)
        print(f"built {name}.png")


if __name__ == "__main__":
    main()
