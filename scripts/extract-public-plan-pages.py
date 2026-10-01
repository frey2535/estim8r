import fitz, sys, json, re, os
src, out_pdf, out_meta = sys.argv[1:4]
doc = fitz.open(src)
targets = [
    ("legend", "ELECTRICAL LEGEND, NOTES, AND SCHEDULES", "E001"),
    ("lighting", "ELECTRICAL LIGHTING PLAN - 1ST FLOOR", "E101"),
    ("power", "ELECTRICAL POWER PLAN - 1ST FLOOR", "E201"),
]
chosen = []
for kind, title, code in targets:
    matches=[]
    for i,p in enumerate(doc):
        text = " ".join((p.get_text("text") or "").upper().split())
        if title in text and code in text:
            matches.append((len(text),i,text[:500]))
    if not matches:
        raise SystemExit(f"No source page found for {kind}: {code} {title}")
    matches.sort(reverse=True)
    chosen.append((kind,matches[0][1]))
out = fitz.open()
meta=[]
for kind, idx in chosen:
    out.insert_pdf(doc, from_page=idx, to_page=idx)
    meta.append({"kind":kind,"source_page":idx+1,"test_page":len(meta)+1})
out.save(out_pdf)
with open(out_meta,"w") as f: json.dump(meta,f,indent=2)
print(json.dumps(meta,indent=2))
