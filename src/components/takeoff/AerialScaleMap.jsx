import React, { useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { haversineFeet } from "@/domain/takeoff/professionalTools";

const LooseMapContainer = /** @type {any} */ (MapContainer);
const LooseTileLayer = /** @type {any} */ (TileLayer);

function Clicks({ origin, onOrigin, onMeasure }) {
  useMapEvents({
    click(event) {
      const point = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (!origin) {
        onOrigin(point);
        return;
      }
      onMeasure(origin, point);
      onOrigin(null);
    },
  });
  return null;
}

export default function AerialScaleMap({ onLength }) {
  const [lat, setLat] = useState("39.95");
  const [lng, setLng] = useState("-75.16");
  const [shown, setShown] = useState(false);
  const [origin, setOrigin] = useState(null);
  const centerLat = Number(lat);
  const centerLng = Number(lng);
  const ready = Number.isFinite(centerLat) && Number.isFinite(centerLng);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1">
        <input aria-label="Aerial latitude" value={lat} onChange={(event) => setLat(event.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs" />
        <input aria-label="Aerial longitude" value={lng} onChange={(event) => setLng(event.target.value)} className="rounded-md border border-input bg-background px-2 py-1 text-xs" />
      </div>
      <button type="button" className="w-full rounded-md border border-border px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted" onClick={() => setShown(true)}>
        Show aerial map
      </button>
      {shown && ready ? (
        <div className="h-48 overflow-hidden rounded-md border border-border">
          <LooseMapContainer center={[centerLat, centerLng]} zoom={18} style={{ height: "100%", width: "100%" }}>
            <LooseTileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Clicks
              origin={origin}
              onOrigin={setOrigin}
              onMeasure={(start, end) => {
                const feet = haversineFeet(start, end);
                if (feet != null) onLength?.(start, end, feet);
              }}
            />
          </LooseMapContainer>
        </div>
      ) : null}
      <p className="text-[11px] leading-4 text-muted-foreground">Click two points on the aerial photo. The distance is the measured ground length in feet. Map tiles are OpenStreetMap.</p>
    </div>
  );
}
