#!/usr/bin/env python3
"""Extract a compact electrical-plan fixture from the Pottsville ADD 2 set."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz

PDF = Path("/Users/marcus/Downloads/2026-0928_24.1079 MCFD Pottsville Fire and EMS Station_ADD 2 SET.pdf")
OUT = Path(__file__).resolve().parents[1] / "src/domain/takeoff/fixtures/pottsville-electrical.json"

PAGES = {
    48: {"sheetId": "E001", "title": "ELECTRICAL LEGEND AND ABBREVIATIONS", "kind": "legend", "discipline": "electrical"},
    50: {"sheetId": "E110", "title": "POWER & SYSTEMS PLAN", "kind": "drawing", "discipline": "electrical"},
    51: {"sheetId": "E111", "title": "POWER PUMP HOUSE LIGHTING", "kind": "drawing", "discipline": "electrical"},
    52: {"sheetId": "E210", "title": "LIGHTING FLOOR PLAN", "kind": "drawing", "discipline": "electrical"},
}


def tokens_for(page) -> list[dict]:
    width, height = page.rect.width, page.rect.height
    out = []
    for word in page.get_text("words"):
        x0, y0, x1, y1, text, *_ = word
        text = str(text).strip()
        if not text:
            continue
        out.append({
            "text": text,
            "x": round(x0 / width * 100, 3),
            "y": round(y0 / height * 100, 3),
        })
    return out


def symbol_paths(page) -> list[dict]:
    width, height = page.rect.width, page.rect.height
    kept = []
    for drawing in page.get_drawings():
        rect = drawing.get("rect")
        if not rect:
            continue
        w = (rect.x1 - rect.x0) / width * 100
        h = (rect.y1 - rect.y0) / height * 100
        if w <= 0 or h <= 0:
            continue
        long, short = max(w, h), min(w, h)
        is_slash = 0.08 <= long <= 0.52 and 0.06 <= short <= 0.16 and 1.28 <= long / short <= 5.4
        is_normal = long >= 0.12 and short >= 0.08 and long <= 5.8 and long / short <= 8 and w * h <= 18
        if not (is_slash or is_normal):
            continue
        cx = ((rect.x0 + rect.x1) / 2) / width * 100
        cy = ((rect.y0 + rect.y1) / 2) / height * 100
        if cx < 6 or cx > 78 or cy < 8 or cy > 86:
            continue
        aspect = w / h
        items = drawing.get("items") or []
        curved = any(item and item[0] in {"c", "v", "y"} for item in items)
        if (curved or len(items) >= 8) and 0.72 < aspect < 1.38:
            kind = "circle"
            radius = long / 2
        elif 1.12 <= aspect or (not curved and len(items) <= 6):
            kind = "rect"
            radius = None
        else:
            kind = "path"
            radius = None
        candidate = {
            "cx": round(cx, 3),
            "cy": round(cy, 3),
            "w": round(w, 3),
            "h": round(h, 3),
            "kind": kind,
            "points": [
                {"x": round(cx - w / 2, 3), "y": round(cy - h / 2, 3)},
                {"x": round(cx + w / 2, 3), "y": round(cy - h / 2, 3)},
                {"x": round(cx + w / 2, 3), "y": round(cy + h / 2, 3)},
                {"x": round(cx - w / 2, 3), "y": round(cy + h / 2, 3)},
            ],
        }
        if radius is not None:
            candidate["r"] = round(radius, 3)
        candidate["outline"] = {
            "kind": kind,
            "source": "vector",
            "w": candidate["w"],
            "h": candidate["h"],
            "r": candidate.get("r"),
            "points": candidate["points"],
        }
        kept.append(candidate)
    kept.sort(key=lambda item: item["w"] * item["h"])
    merged = []
    for item in kept:
        overlap = False
        for other in merged:
            min_x = max(item["cx"] - item["w"] / 2, other["cx"] - other["w"] / 2)
            min_y = max(item["cy"] - item["h"] / 2, other["cy"] - other["h"] / 2)
            max_x = min(item["cx"] + item["w"] / 2, other["cx"] + other["w"] / 2)
            max_y = min(item["cy"] + item["h"] / 2, other["cy"] + other["h"] / 2)
            if max_x <= min_x or max_y <= min_y:
                continue
            inter = (max_x - min_x) * (max_y - min_y)
            if inter / (item["w"] * item["h"] + other["w"] * other["h"] - inter) >= 0.55:
                overlap = True
                break
        if not overlap:
            merged.append(item)
    return merged[:2200]


def main() -> int:
    if not PDF.exists():
        print(f"missing {PDF}", file=sys.stderr)
        return 1
    doc = fitz.open(PDF)
    pages = []
    for number, meta in PAGES.items():
        page = doc[number - 1]
        pages.append({
            "page": number,
            "kind": meta["kind"],
            "sheetId": meta["sheetId"],
            "title": meta["title"],
            "discipline": meta["discipline"],
            "tokens": tokens_for(page),
            "paths": symbol_paths(page) if meta["kind"] == "drawing" else [],
        })
    fixture = {
        "source": {
            "fileName": "2026-0928_24.1079 MCFD Pottsville Fire and EMS Station_ADD 2 SET.pdf",
            "project": "MCFD Pottsville Fire and EMS Station",
            "set": "ADD 2 SET",
            "pages": [page["page"] for page in pages],
        },
        "drawingSymbols": [
            {"id": "sched:e001:1", "abbr": "1", "type": "1", "label": "Type 1 lighting fixture", "takeoffCategory": "Lighting", "category": "From drawing", "source": "legend", "page": 48},
            {"id": "sched:e001:2", "abbr": "2", "type": "2", "label": "Type 2 recessed downlight", "takeoffCategory": "Lighting", "category": "From drawing", "source": "legend", "page": 48},
            {"id": "sched:e001:3", "abbr": "3", "type": "3", "label": "Type 3 lighting fixture", "takeoffCategory": "Lighting", "category": "From drawing", "source": "legend", "page": 48},
            {"id": "sched:e001:4", "abbr": "4", "type": "4", "label": "Type 4 4 inch downlight", "takeoffCategory": "Lighting", "category": "From drawing", "source": "legend", "page": 48},
            {"id": "sched:e001:OS", "abbr": "OS", "type": "OS", "label": "Occupancy sensor", "takeoffCategory": "Lighting", "category": "From drawing", "source": "legend", "page": 48},
            {"id": "sched:e001:WP", "abbr": "WP", "type": "WP", "label": "Weatherproof receptacle", "takeoffCategory": "Receptacles", "category": "From drawing", "source": "legend", "page": 48},
            {"id": "sched:e001:GFI", "abbr": "GFI", "type": "GFI", "label": "GFI duplex receptacle", "takeoffCategory": "Receptacles", "category": "From drawing", "source": "legend", "page": 48},
        ],
        "pages": pages,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixture, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    for page in pages:
        print(page["sheetId"], "tokens", len(page["tokens"]), "paths", len(page["paths"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
