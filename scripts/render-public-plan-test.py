import json, sys, os
import fitz
from PIL import Image, ImageDraw, ImageFont

pdf_path = sys.argv[1]
json_path = sys.argv[2]
out_dir = sys.argv[3]
os.makedirs(out_dir, exist_ok=True)

with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

doc = fitz.open(pdf_path)
font = ImageFont.load_default()

def hex_to_rgb(value):
    value = (value or "#2563eb").lstrip("#")
    if len(value) == 3:
        value = "".join(c*2 for c in value)
    return tuple(int(value[i:i+2], 16) for i in (0,2,4))

def draw_mark(draw, mark, w, h):
    color = hex_to_rgb(mark.get("color"))
    opacity = float(mark.get("fillOpacity", 0.5))
    fill = (*color, int(max(0,min(1,opacity))*255))
    stroke = (*color, 255)
    outline = mark.get("resolvedOutline") or {}
    kind = outline.get("kind", "rect")
    x = float(mark.get("x",0)) / 100.0 * w
    y = float(mark.get("y",0)) / 100.0 * h

    if kind == "path" and outline.get("points"):
        pts = [(float(p["x"])/100*w, float(p["y"])/100*h) for p in outline["points"]]
        draw.polygon(pts, fill=fill, outline=stroke)
    elif kind == "circle":
        r = float(outline.get("r",0.45))
        rx, ry = r/100*w, r/100*h
        draw.ellipse((x-rx,y-ry,x+rx,y+ry), fill=fill, outline=stroke, width=2)
    else:
        ow = float(outline.get("w",0.95))/100*w
        oh = float(outline.get("h",0.55))/100*h
        draw.rectangle((x-ow/2,y-oh/2,x+ow/2,y+oh/2), fill=fill, outline=stroke, width=2)

    label = mark.get("typeCode") or mark.get("abbr") or mark.get("symbolLabel") or "•"
    tx = x
    ty = max(2, y - max(14, float(mark.get("markerSize",1.45))*0.017*h))
    bbox = draw.textbbox((0,0), label, font=font, stroke_width=2)
    tw = bbox[2]-bbox[0]
    draw.text((tx-tw/2,ty), label, font=font, fill=stroke, stroke_width=2, stroke_fill=(255,255,255,255))

marks_by_page = {}
for m in data.get("marks", []):
    marks_by_page.setdefault(int(m.get("sheet",1)), []).append(m)

manifest = []
for page_num in range(1, len(doc)+1):
    page = doc[page_num-1]
    pix = page.get_pixmap(matrix=fitz.Matrix(4.0,4.0), alpha=False)
    base = Image.frombytes("RGB", [pix.width, pix.height], pix.samples).convert("RGBA")
    if page_num == 1:
        out = os.path.join(out_dir, "01-legend-source.png")
        base.convert("RGB").save(out, quality=95)
        manifest.append({"page":page_num,"kind":"legend","image":out,"marks":0})
        continue
    overlay = Image.new("RGBA", base.size, (255,255,255,0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for mark in marks_by_page.get(page_num, []):
        draw_mark(draw, mark, base.width, base.height)
    combined = Image.alpha_composite(base, overlay)
    name = "02-lighting-estim8r-marked.png" if page_num == 2 else "03-power-estim8r-marked.png"
    out = os.path.join(out_dir, name)
    combined.convert("RGB").save(out, quality=95)
    # Also emit high-resolution plan-area crops so symbol fills can be inspected on a phone.
    crop_box = (int(base.width*0.05), int(base.height*0.08), int(base.width*0.82), int(base.height*0.88))
    crop = combined.crop(crop_box).convert("RGB")
    crop_name = "02-lighting-zoom.png" if page_num == 2 else "03-power-zoom.png"
    crop_out = os.path.join(out_dir, crop_name)
    crop.save(crop_out, quality=98)
    manifest.append({"page":page_num,"image":out,"zoom":crop_out,"marks":len(marks_by_page.get(page_num,[]))})

with open(os.path.join(out_dir, "render-manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
print(json.dumps(manifest, indent=2))
