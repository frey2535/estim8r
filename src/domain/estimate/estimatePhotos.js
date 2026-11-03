const DATABASE = "estim8r-estimate-photos";
const STORE = "photos";
const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("estimateId", "estimateId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function listEstimatePhotos(estimateId) {
  if (!estimateId) return [];
  const records = await transaction("readonly", (store) => store.index("estimateId").getAll(estimateId));
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addEstimatePhoto(estimateId, file) {
  if (!estimateId) throw new Error("Save the estimate before adding photos.");
  if (!TYPES.has(file.type)) throw new Error("Unsupported photo format.");
  if (file.size > MAX_BYTES) throw new Error("Photos must be 15 MB or smaller.");
  const record = {
    id: crypto.randomUUID(),
    estimateId,
    name: file.name || "Camera photo",
    mimeType: file.type,
    size: file.size,
    createdAt: new Date().toISOString(),
    description: "",
    file,
    syncStatus: "local_only",
  };
  await transaction("readwrite", (store) => store.put(record));
  return record;
}

export async function updateEstimatePhoto(record) {
  await transaction("readwrite", (store) => store.put(record));
}

export async function deleteEstimatePhoto(id) {
  await transaction("readwrite", (store) => store.delete(id));
}
