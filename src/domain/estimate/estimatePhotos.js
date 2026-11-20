import { requireSupabase } from "@/api/supabaseClient";

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


// Company-scoped cloud photo storage. The bucket must be private and protected
// by the storage policies in supabase/migrations/20261120_estimate_photos.sql.
const PHOTO_BUCKET = "estim8r-estimate-photos";

async function photoContext() {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth?.user) throw new Error("Sign in to synchronize estimate photos.");
  const { error: activationError } = await client.rpc("estim8r_activate_invited_employee");
  if (activationError) throw activationError;
  const { data: profile, error } = await client.from("profiles").select("org_id").eq("id", auth.user.id).single();
  if (error || !profile?.org_id) throw new Error("No company linked to this account.");
  return { client, orgId: profile.org_id };
}

function photoPath(orgId, estimateId, photoId) {
  return `${orgId}/${estimateId}/${photoId}`;
}

async function cloudUpload(record, context) {
  const path = photoPath(context.orgId, record.estimateId, record.id);
  const { error } = await context.client.storage.from(PHOTO_BUCKET).upload(path, record.file, {
    contentType: record.mimeType, upsert: false,
    metadata: { name: record.name, description: record.description || "", createdAt: record.createdAt },
  });
  if (error && !/already exists|duplicate/i.test(error.message || "")) throw error;
  record.syncStatus = "synced";
  await updateEstimatePhoto(record);
}

export async function syncEstimatePhotos(estimateId) {
  if (!estimateId) return [];
  const context = await photoContext();
  const local = await listEstimatePhotos(estimateId);
  const prefix = `${context.orgId}/${estimateId}`;
  const { data: remote, error } = await context.client.storage.from(PHOTO_BUCKET).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Photo synchronization unavailable: ${error.message}`);
  const remoteIds = new Set((remote || []).filter((item) => item.name && item.name !== ".emptyFolderPlaceholder").map((item) => item.name));
  for (const record of local) {
    if (remoteIds.has(record.id)) continue;
    // Local originals are never deleted, including when a cloud upload fails.
    await cloudUpload(record, context);
    remoteIds.add(record.id);
  }
  const results = [];
  for (const id of remoteIds) {
    const localRecord = local.find((photo) => photo.id === id);
    if (localRecord) {
      results.push(localRecord);
      continue;
    }
    const path = photoPath(context.orgId, estimateId, id);
    const { data, error: downloadError } = await context.client.storage.from(PHOTO_BUCKET).download(path);
    if (downloadError) throw downloadError;
    const file = new File([data], id, { type: data.type || "image/jpeg" });
    const record = { id, estimateId, name: id, mimeType: file.type, size: file.size,
      createdAt: new Date().toISOString(), description: "", file, syncStatus: "synced" };
    await updateEstimatePhoto(record);
    results.push(record);
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addAndSyncEstimatePhoto(estimateId, file) {
  const record = await addEstimatePhoto(estimateId, file);
  try { await cloudUpload(record, await photoContext()); }
  catch (error) { throw new Error(`Photo saved on this device, but cloud sync failed: ${error.message}`); }
  return record;
}

export async function deleteSyncedEstimatePhoto(photo) {
  const context = await photoContext();
  const { error } = await context.client.storage.from(PHOTO_BUCKET).remove([photoPath(context.orgId, photo.estimateId, photo.id)]);
  if (error) throw error;
  await deleteEstimatePhoto(photo.id);
}
