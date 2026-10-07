import React, { useEffect, useMemo, useState } from "react";
import { searchLiveSupplierCatalog } from "@/api/liveSupplierCatalog";
import { catalogQueryForLine, pickAutoApplyOffer } from "@/domain/estimate/liveSupplierCatalog";

export default function LiveSupplierCatalog({ lines = [], onApplyPrice }) {
  const defaultQuery = useMemo(() => {
    const withText = lines.find((line) => catalogQueryForLine(line));
    return withText ? catalogQueryForLine(withText) : "";
  }, [lines]);
  const [query, setQuery] = useState(defaultQuery);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState(null);
  const [targetId, setTargetId] = useState(lines[0]?.id || "");

  useEffect(() => {
    if (!query && defaultQuery) setQuery(defaultQuery);
  }, [defaultQuery, query]);
  useEffect(() => {
    if (!targetId && lines[0]?.id) setTargetId(lines[0].id);
  }, [lines, targetId]);

  const searchable = lines.filter((line) => catalogQueryForLine(line));

  async function runSearch(nextQuery = query) {
    setBusy(true);
    setStatus("Searching live distributor catalogs…");
    try {
      const line = lines.find((row) => row.id === targetId);
      const result = await searchLiveSupplierCatalog({
        query: nextQuery,
        quantity: Number(line?.quantity) || 1,
      });
      setPayload(result);
      setStatus(result.message || "");
    } catch (error) {
      setPayload(null);
      setStatus(error.message || "Live catalog search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function checkConnections() {
    setBusy(true);
    setStatus("Checking supplier connections…");
    try {
      const result = await searchLiveSupplierCatalog({ query: "", quantity: 1 });
      setPayload(result);
      const ready = (result.diagnostics || []).filter((row) => row.configured).length;
      setStatus(ready
        ? `${ready} supplier connection${ready === 1 ? "" : "s"} configured. See status below.`
        : "No live supplier connections are configured yet. See status below.");
    } catch (error) {
      setPayload(null);
      setStatus(error.message || "Supplier connection check failed.");
    } finally {
      setBusy(false);
    }
  }

  async function priceMatchingLines() {
    if (!searchable.length) {
      setStatus("Add a model or description on an estimate line first.");
      return;
    }
    setBusy(true);
    let applied = 0;
    let searched = 0;
    const notes = [];
    try {
      for (const line of searchable) {
        searched += 1;
        setStatus(`Pricing line ${searched} of ${searchable.length} from live catalogs…`);
        const result = await searchLiveSupplierCatalog({
          query: catalogQueryForLine(line),
          quantity: Number(line.quantity) || 1,
        });
        if (!result.configured?.length) {
          setPayload(result);
          setStatus(result.message);
          return;
        }
        const match = pickAutoApplyOffer(line, result.results || []);
        if (match) {
          onApplyPrice?.(line, match);
          applied += 1;
        } else {
          notes.push(line.description || line.model || line.id);
        }
      }
      setStatus(applied
        ? `Applied ${applied} live catalog ${applied === 1 ? "price" : "prices"}. ${notes.length ? `Review unmatched: ${notes.slice(0, 4).join(", ")}` : "Strong model/SKU matches only."}`
        : "No line had a strong live model/SKU match. Search below and apply a price yourself. No prices were invented.");
    } catch (error) {
      setStatus(error.message || "Live catalog pricing failed.");
    } finally {
      setBusy(false);
    }
  }

  const results = payload?.results || [];
  const configured = payload?.configured || [];
  const diagnostics = payload?.diagnostics || [];

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-orange-500">Live catalogs</p>
        <h2 className="mt-1 text-xl font-black">Search current supplier prices</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Searches connected supplier pricing for Home Depot, Lowe's, City Electric Supply, Inline Electric Supply,
          Wesco / Anixter, Graybar, Grainger, MSC Industrial, Mouser, Digi-Key, Nexar Supply, and Newark / element14.
          Estim8r only displays prices returned by a configured live connection and never invents a price.
        </p>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_12rem_auto_auto]">
        <label>
          <span className="mb-1 block text-[11px] font-bold text-muted-foreground">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
            placeholder="Model, SKU, or description"
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          />
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-bold text-muted-foreground">Apply to line</span>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
            {lines.map((line) => (
              <option key={line.id} value={line.id}>{line.description || line.model || "Untitled line"}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => runSearch()} className="self-end rounded-md border border-border px-3 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50">
          {busy ? "Searching…" : "Search live"}
        </button>
        <button type="button" disabled={busy} onClick={priceMatchingLines} className="self-end rounded-md bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-orange-500 dark:hover:bg-orange-600">
          Price matching lines
        </button>
        <button type="button" disabled={busy} onClick={checkConnections} className="self-end rounded-md border border-border px-3 py-2 text-sm font-bold hover:bg-muted disabled:opacity-50 md:col-start-4">
          Check connections
        </button>
      </div>
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
      {configured.length ? (
        <p className="mt-1 text-[11px] text-muted-foreground">Sources used: {configured.join(", ")}</p>
      ) : null}
      {(payload?.errors || []).length ? (
        <div className="mt-2 space-y-1 text-xs text-amber-700">
          {payload.errors.map((error) => <div key={error.message}>{error.message}</div>)}
        </div>
      ) : null}
      {diagnostics.length ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {diagnostics.map((row) => (
            <div key={row.id} className="rounded-lg border border-border px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{row.supplier}</span>
                <span className={row.configured ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>
                  {row.configured ? "Connected" : "Setup needed"}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">
                {row.configured ? (row.mode === "authorized-gateway" ? "Authorized account pricing gateway" : "Official supplier API") : row.reason}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-4 space-y-2">
        {results.map((offer) => (
          <div key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0">
              <div className="font-bold">{offer.supplier}</div>
              <div className="text-sm">{offer.description || offer.mpn || offer.sku}</div>
              <div className="text-[11px] text-muted-foreground">
                {offer.mpn ? `MPN ${offer.mpn}` : ""}{offer.sku ? ` · SKU ${offer.sku}` : ""} · live {money(offer.unitCost)} {offer.currency} / {offer.unit || "EA"}
                {offer.availability ? ` · ${offer.availability}` : ""}
                {offer.url ? <> · <a href={offer.url} target="_blank" rel="noreferrer" className="underline">catalog</a></> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const line = lines.find((row) => row.id === targetId) || lines[0];
                if (line) onApplyPrice?.(line, offer);
              }}
              className="rounded-md border border-border px-2 py-1 text-xs font-bold hover:bg-muted"
            >
              Use live price
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}
