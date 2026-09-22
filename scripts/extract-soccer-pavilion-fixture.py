#!/usr/bin/env python3
"""Extract a compact takeoff fixture from the Soccer Pavilion CD set."""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import fitz

PDF = Path("/Users/marcus/Downloads/257031-Soccer Pavilion-DRAWINGS.pdf")
OUT = Path(__file__).resolve().parents[1] / "src/domain/takeoff/fixtures/soccer-pavilion-electrical.json"

PAGES = {
    3: {"sheetId": "A1.10", "title": "LIFE SAFETY PLAN - MAIN LEVEL"},
    47: {"sheetId": "E0.00", "title": "ELECTRICAL LEGEND AND SCHEDULES"},
    48: {"sheetId": "E0.01", "title": "ELECTRICAL SITE PLAN"},
    49: {"sheetId": "E0.02", "title": "ELECTRICAL SITE PLAN DETAILS"},
    50: {"sheetId": "E1.01", "title": "LIGHTING FLOOR PLAN - MAIN LEVEL"},
    51: {"sheetId": "E2.01", "title": "POWER FLOOR PLAN - MAIN LEVEL"},
    52: {"sheetId": "E3.01", "title": "ELECTRICAL RISER DIAGRAM"},
}

KIND = {
    3: "drawing",
    47: "lighting-schedule",
    48: "drawing",
    49: "detail",
    50: "drawing",
    51: "drawing",
    52: "oneline",
}

DISCIPLINE = {
    3: "architectural",
    47: "electrical",
    48: "electrical",
    49: "electrical",
    50: "electrical",
    51: "electrical",
    52: "electrical",
}

QUOTE_RE = re.compile(r"^['\"‘’“”`](.+?)['\"‘’“”`]$")
TYPE_RE = re.compile(r"^(?:[A-Z]{1,3}\d{0,2}[A-Z]?|\d{1,2}[A-Z]?)$", re.I)


def normalize(text: str) -> str:
    raw = str(text or "").strip()
    raw = re.sub(r"^['\"‘’“”`]+|['\"‘’“”`]+$", "", raw)
    raw = re.sub(r"^type\s+", "", raw, flags=re.I)
    raw = re.sub(r"[.,;:()]+$", "", raw)
    return raw


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
        if long < 0.12 or long > 5.8 or short < 0.08 or long / short > 8 or w * h > 18:
            continue
        cx = ((rect.x0 + rect.x1) / 2) / width * 100
        cy = ((rect.y0 + rect.y1) / 2) / height * 100
        if cx < 6 or cx > 78 or cy < 8 or cy > 72:
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
    return merged[:1800]


def is_junk(path: dict) -> bool:
    long = max(path["w"], path["h"])
    short = min(path["w"], path["h"])
    if long < 0.18 or short < 0.09:
        return True
    if long > 2.7 and short < 0.9:
        return True
    if short and long / short > 6 and long > 1.8:
        return True
    return False


def plausible_for_hint(path, hint):
    if is_junk(path):
        return False
    long = max(path["w"], path["h"])
    short = min(path["w"], path["h"])
    aspect = long / short if short else 99
    if hint == "circle":
        return path["kind"] == "circle" and long <= 1.25 and aspect <= 1.45
    if hint == "rect":
        return 0.22 <= long <= 2.3 and aspect <= 4.2
    return long <= 2.3 and aspect <= 4.5


def looks_like_text_glyph(tag: dict, path: dict) -> bool:
    dist = ((tag["x"] - path["cx"]) ** 2 + (tag["y"] - path["cy"]) ** 2) ** 0.5
    size = max(path["w"], path["h"])
    token_len = max(len(str(tag.get("type") or "X")), 1)
    expected = max(0.35, token_len * 0.42)
    return dist < 0.7 and size <= expected + 0.4 and size < 1.35


def nearest_path(tag: dict, paths: list[dict]) -> dict | None:
    hint = tag.get("shapeHint")
    max_dist = 1.2 if hint == "circle" else 1.5 if hint == "rect" else 0.9
    best = None
    best_score = -1e9
    for path in paths:
        if not plausible_for_hint(path, hint):
            continue
        if looks_like_text_glyph(tag, path):
            continue
        dist = ((tag["x"] - path["cx"]) ** 2 + (tag["y"] - path["cy"]) ** 2) ** 0.5
        inside = (
            abs(tag["x"] - path["cx"]) <= path["w"] / 2 + 0.05
            and abs(tag["y"] - path["cy"]) <= path["h"] / 2 + 0.05
        )
        if dist > max_dist and not inside:
            continue
        if hint == "rect" and not inside and (max(path["w"], path["h"]) < 0.55 or path["w"] * path["h"] < 0.28):
            continue
        long = max(path["w"], path["h"])
        short = min(path["w"], path["h"])
        aspect = long / short if short else 99
        score = (3.2 - dist) + min(long, 1.5) * 0.85
        if long < 0.22:
            score -= 1.4
        if hint == "circle":
            if path["kind"] == "circle" or aspect <= 1.45:
                score += 0.75
            if aspect > 1.8 or long > 1.1:
                score -= 1.2
            if 0.2 <= long <= 0.7:
                score += 0.45
        elif hint == "rect":
            if path["kind"] == "rect":
                score += 0.45
            if 0.4 <= long <= 1.8:
                score += 0.7
            if long < 0.28:
                score -= 0.9
        if score > best_score:
            best = path
            best_score = score
    if best is None or best_score < 1.35:
        return None
    return best


def ground_truth(pages: list[dict]) -> list[dict]:
    devices = []
    lighting = next(page for page in pages if page["sheetId"] == "E1.01")
    power = next(page for page in pages if page["sheetId"] == "E2.01")
    site = next(page for page in pages if page["sheetId"] == "E0.01")

    shape_for = {
        "1": "rect", "1E": "rect", "3": "rect", "3E": "rect",
        "2": "circle", "2E": "circle", "4": "circle", "F": "circle",
        "OS": "circle", "GFI": "circle", "GFI/WP": "circle", "VF": "rect", "EF": "rect",
    }

    for token in lighting["tokens"]:
        quoted = QUOTE_RE.match(token["text"])
        code = quoted.group(1).upper() if quoted else ""
        if code in {"1", "1E", "2", "2E", "3", "3E", "4", "F"} and 8 <= token["x"] <= 62 and 10 <= token["y"] <= 58:
            devices.append({
                "sheet": lighting["page"],
                "type": code,
                "x": token["x"],
                "y": token["y"],
                "shapeHint": shape_for[code],
                "source": "quoted-type",
            })
        if token["text"] == "OS" and 8 <= token["x"] <= 62 and 10 <= token["y"] <= 58:
            devices.append({
                "sheet": lighting["page"],
                "type": "OS",
                "x": token["x"],
                "y": token["y"],
                "shapeHint": "circle",
                "source": "occupancy",
            })

    for token in power["tokens"]:
        text = token["text"]
        if text in {"GFI", "GFI/WP"} and 8 <= token["x"] <= 62 and 10 <= token["y"] <= 58:
            devices.append({
                "sheet": power["page"],
                "type": text,
                "x": token["x"],
                "y": token["y"],
                "shapeHint": "circle",
                "source": "receptacle",
            })
        tagged = re.match(r"^(VF|EF)(?:[- ]?\d+)?$", text, re.I)
        if tagged and 8 <= token["x"] <= 62 and 10 <= token["y"] <= 58:
            devices.append({
                "sheet": power["page"],
                "type": tagged.group(1).upper(),
                "x": token["x"],
                "y": token["y"],
                "shapeHint": "circle",
                "source": "fan",
            })

    for token in site["tokens"]:
        if token["text"] == "GFI/WP" and 6.5 <= token["x"] <= 20 and 40 <= token["y"] <= 55:
            devices.append({
                "sheet": site["page"],
                "type": "GFI/WP",
                "x": token["x"],
                "y": token["y"],
                "shapeHint": "circle",
                "source": "site-receptacle",
            })

    by_sheet = {page["page"]: page for page in pages}
    for device in devices:
        path = nearest_path(device, by_sheet[device["sheet"]].get("paths") or [])
        if path and ((device["x"] - path["cx"]) ** 2 + (device["y"] - path["cy"]) ** 2) ** 0.5 <= 2.2:
            device["cx"] = path["cx"]
            device["cy"] = path["cy"]
            device["w"] = path["w"]
            device["h"] = path["h"]
            device["kind"] = path["kind"]
        else:
            device["cx"] = device["x"]
            device["cy"] = device["y"]
            device["w"] = 0.9
            device["h"] = 0.9
            device["kind"] = device["shapeHint"]
            device["tagOnSymbol"] = True
    return devices


def drawing_symbols(pages: list[dict]) -> list[dict]:
    legend = next(page for page in pages if page["sheetId"] == "E0.00")
    rows = []
    for token in legend["tokens"]:
        if not rows or abs(rows[-1]["y"] - token["y"]) > 1.1:
            rows.append({"y": token["y"], "tokens": [token]})
        else:
            rows[-1]["tokens"].append(token)
    wanted = {
        "1": "Type 1 2x4 LED surface troffer",
        "1E": "Type 1E 2x4 LED surface troffer with emergency battery",
        "2": "Type 2 8 inch recessed downlight",
        "2E": "Type 2E 8 inch recessed downlight with emergency battery",
        "3": "Type 3 LED surface strip light",
        "3E": "Type 3E LED surface strip light with emergency battery",
        "4": "Type 4 4 inch surface downlight",
        "F": "Type F pendant outdoor fan",
    }
    return [{
        "id": f"sched:lighting-schedule:{code}",
        "abbr": code,
        "type": code,
        "label": label,
        "takeoffCategory": "Equipment" if code == "F" else "Lighting",
        "category": "From drawing",
        "source": "lighting-schedule",
        "page": legend["page"],
    } for code, label in wanted.items()]


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
            "kind": KIND[number],
            "sheetId": meta["sheetId"],
            "title": meta["title"],
            "discipline": DISCIPLINE[number],
            "tokens": tokens_for(page),
            "paths": symbol_paths(page) if KIND[number] == "drawing" else [],
        })
    devices = ground_truth(pages)
    counts = defaultdict(int)
    for device in devices:
        counts[f"{device['type']}@{device['sheet']}"] += 1
    fixture = {
        "source": {
            "fileName": "257031-Soccer Pavilion-DRAWINGS.pdf",
            "project": "Shelbyville Multipurpose Soccer Field Complex Pavilion",
            "set": "100% CD SET",
            "pages": [page["page"] for page in pages],
        },
        "drawingSymbols": drawing_symbols(pages),
        "pages": pages,
        "groundTruth": devices,
        "expectedCounts": dict(sorted(counts.items())),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fixture, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print("counts", dict(counts))
    print("devices", len(devices))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
