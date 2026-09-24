import React from "react";
import { Link } from "react-router-dom";

export default function TakeoffSourceAudit({ lines = [], drawingFileName = "" }) {
  const sourced = lines.filter((line) => line.sourceAudit?.count);
  if (!sourced.length) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Drawing source audit</h3>
          <p className="mt-1 text-xs text-muted-foreground">Trace estimate quantities to the drawing marks and conduit runs that created them.</p>
        </div>
        <Link to="/takeoff" className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted">Open drawing takeoff</Link>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-2">Estimate item</th><th className="p-2">Sheets</th><th className="p-2">Source marks</th><th className="p-2">Conduit runs</th><th className="p-2">AI review</th></tr>
          </thead>
          <tbody>
            {sourced.map((line) => {
              const audit = line.sourceAudit;
              return <tr key={line.id} className="border-b border-border">
                <td className="p-2"><div className="font-semibold">{line.description}</div><div className="text-[11px] text-muted-foreground">{drawingFileName || "Drawing takeoff"}</div></td>
                <td className="p-2">{(audit.sheets || []).join(", ") || "—"}</td>
                <td className="p-2">{audit.count}</td>
                <td className="p-2">{(audit.runNumbers || []).map((n) => "C" + n).join(", ") || "—"}</td>
                <td className="p-2">{audit.aiCount ? (audit.unresolvedAi ? audit.unresolvedAi + " unresolved" : "Reviewed") : "Manual"}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
