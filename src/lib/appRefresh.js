export async function refreshCurrentFlowApp() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache clearing is best effort.
  }

  const url = new URL(window.location.href);
  url.searchParams.set("t", String(Date.now()));
  window.location.replace(url.toString());
}
