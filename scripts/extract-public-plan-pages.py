import fitz, sys, json
src, out_pdf, out_meta = sys.argv[1:4]
doc = fitz.open(src)
targets = [
    ("legend", "ELECTRICAL LEGEND AND SCHEDULES", "E-001"),
    ("lighting", "STILLWELL ELECTRICAL LIGHTING PLAN - LEVEL 1", "ES-101"),
    ("power", "STILLWELL ELECTRICAL POWER PLAN - LEVEL 1", "ES-201"),
]

def score_page(p, title, code):
    w, h = p.rect.width, p.rect.height
    score = 0
    full = " ".join((p.get_text("text") or "").upper().split())
    if "DRAWING INDEX" in full or "SHEET INDEX" in full:
        score -= 500
    for b in p.get_text("blocks"):
        x0,y0,x1,y1,txt = b[:5]
        t = " ".join((txt or "").upper().split())
        bottom = y0 > h * 0.70
        right = x0 > w * 0.55
        if code in t:
            score += 20 + (250 if bottom else 0) + (150 if right else 0)
        if title in t:
            score += 40 + (250 if bottom else 0) + (100 if right else 0)
    if title in full: score += 20
    if code in full: score += 10
    return score

chosen, used = [], set()
for kind, title, code in targets:
    ranked = sorted(((score_page(p,title,code),i) for i,p in enumerate(doc)), reverse=True)
    ranked = [(s,i) for s,i in ranked if s > 0 and i not in used]
    if not ranked:
        raise SystemExit(f"No distinct source page found for {kind}: {code} {title}")
    s, idx = ranked[0]
    used.add(idx)
    chosen.append((kind,idx,s))

if len({i for _,i,_ in chosen}) != 3:
    raise SystemExit("Extraction failed: legend, lighting and power must be distinct source pages")

out = fitz.open()
meta=[]
for kind, idx, score in chosen:
    out.insert_pdf(doc, from_page=idx, to_page=idx)
    meta.append({"kind":kind,"source_page":idx+1,"test_page":len(meta)+1,"selection_score":score})
out.save(out_pdf)
with open(out_meta,"w") as f: json.dump(meta,f,indent=2)
print(json.dumps(meta,indent=2))
