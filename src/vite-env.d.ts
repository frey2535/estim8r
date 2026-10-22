/// <reference types="vite/client" />

declare module "*?url" {
  const src: string;
  export default src;
}

declare module "*.svg?url" {
  const src: string;
  export default src;
}

declare module "*.png?url" {
  const src: string;
  export default src;
}

declare module "react-leaflet" {
  import type * as React from "react";
  export const MapContainer: React.ComponentType<Record<string, unknown>>;
  export const TileLayer: React.ComponentType<Record<string, unknown>>;
  export function useMapEvents(props: Record<string, unknown>): null;
}
