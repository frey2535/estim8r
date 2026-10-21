import React, { useEffect, useState } from "react";
import { QUANTITY_LINK_CHANNEL, readLiveQuantity } from "@/domain/takeoff/professionalTools";

export default function QuantityLinkPage() {
  const [csv, setCsv] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    const stored = readLiveQuantity();
    if (stored?.kind === "estim8r-quantity") {
      setCsv(String(stored.csv || ""));
      setUpdatedAt(stored.updatedAt || "");
    }
    const channel = new BroadcastChannel(QUANTITY_LINK_CHANNEL);
    channel.onmessage = (event) => {
      if (event?.data?.kind !== "estim8r-quantity") return;
      setCsv(String(event.data.csv || ""));
      setUpdatedAt(event.data.updatedAt || new Date().toISOString());
    };
    return () => channel.close();
  }, []);

  const rows = csv ? csv.trim().split(/\n/).map((line) => line.split(",")) : [];

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-2xl font-semibold">Live quantity link</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This window updates when the takeoff publishes quantities. Excel can open the downloaded workbook. Leave this window open beside the drawing.
      </p>
      <p className="mt-3 text-sm">{updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : "Waiting for a takeoff publish."}</p>
      {rows.length ? (
        <div className="mt-4 overflow-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-sm">
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${index}-${row[0]}`} className={index === 0 ? "bg-muted font-semibold" : "border-t border-border"}>
                  {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2">{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
