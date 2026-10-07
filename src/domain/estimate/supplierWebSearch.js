const SUPPLIERS = [
  ["homedepot","Home Depot","homedepot.com"],
  ["lowes","Lowe's","lowes.com"],
  ["cityelectric","City Electric Supply","cityelectricsupply.com"],
  ["inlineelectric","Inline Electric Supply","inlineelectric.com"],
  ["wesco","Wesco / Anixter","wesco.com"],
  ["graybar","Graybar","graybar.com"],
  ["grainger","Grainger","grainger.com"],
  ["msc","MSC Industrial","mscdirect.com"],
];

export const NO_SECRET_SUPPLIERS = SUPPLIERS.map(([id,supplier,domain])=>({id,supplier,domain}));

export function supplierPublicSearchUrl(supplierId, query="") {
  const row = NO_SECRET_SUPPLIERS.find((item)=>item.id===supplierId);
  if(!row) return "";
  const q = [`site:${row.domain}`, String(query||"").trim()].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function supplierPublicSearches(query="") {
  return NO_SECRET_SUPPLIERS.map((row)=>({...row,url:supplierPublicSearchUrl(row.id,query)}));
}
