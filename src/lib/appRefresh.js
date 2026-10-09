import { clearStaleClientCaches } from "./update-check";

export async function refreshCurrentFlowApp() {
  await clearStaleClientCaches();
  const url = new URL(window.location.href);
  url.searchParams.set("t", String(Date.now()));
  window.location.replace(url.toString());
}
