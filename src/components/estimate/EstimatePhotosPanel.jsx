import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { addEstimatePhoto, deleteEstimatePhoto, listEstimatePhotos, updateEstimatePhoto } from "@/domain/estimate/estimatePhotos";

export default function EstimatePhotosPanel({ estimateId }) {
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    listEstimatePhotos(estimateId).then((rows) => { if (active) setPhotos(rows); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [estimateId]);

  async function refresh() { setPhotos(await listEstimatePhotos(estimateId)); }

  async function upload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || busy) return;
    setBusy(true);
    setError("");
    try {
      for (const file of files) await addEstimatePhoto(estimateId, file);
      await refresh();
    } catch (err) { setError(err.message || "Unable to save photo."); }
    finally { setBusy(false); }
  }

  async function remove(photo) {
    if (!window.confirm("Delete this photo from this estimate?")) return;
    try { await deleteEstimatePhoto(photo.id); await refresh(); }
    catch (err) { setError(err.message); }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-bold">Estimate Photos & Attachments</h3><p className="text-xs text-muted-foreground">Photos are stored on this device. Buildr transfer is not yet available.</p></div>
        <div className="flex gap-2">
          <input ref={galleryRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={upload} aria-label="Upload estimate photos" />
          <input ref={cameraRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={upload} aria-label="Take estimate photo" />
          <button type="button" disabled={!estimateId || busy} onClick={() => galleryRef.current?.click()} className="rounded-lg border px-3 py-2 text-sm flex items-center gap-2"><ImagePlus size={16}/>Upload</button>
          <button type="button" disabled={!estimateId || busy} onClick={() => cameraRef.current?.click()} className="rounded-lg border px-3 py-2 text-sm flex items-center gap-2"><Camera size={16}/>Take photo</button>
        </div>
      </div>
      {busy && <p role="status">Saving photos...</p>}
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {!photos.length && <p className="text-sm text-muted-foreground">No estimate photos yet.</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {photos.map((photo) => <PhotoCard key={photo.id} photo={photo} onDelete={() => remove(photo)} onChange={async (description) => {
          try { await updateEstimatePhoto({ ...photo, description }); await refresh(); }
          catch (err) { setError(err.message); }
        }} />)}
      </div>
    </section>
  );
}

function PhotoCard({ photo, onDelete, onChange }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(photo.file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [photo.file]);
  return <div className="rounded-lg border overflow-hidden">
    {url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={photo.description || photo.name} className="aspect-square w-full object-cover" /></a>}
    <div className="p-2 space-y-2">
      <input aria-label="Photo description" className="w-full rounded border bg-background p-1 text-xs" defaultValue={photo.description} onBlur={(event) => { if (event.target.value !== photo.description) onChange(event.target.value); }} placeholder="Photo description" />
      <button type="button" onClick={onDelete} className="text-xs text-red-600 flex items-center gap-1"><Trash2 size={13}/>Delete</button>
    </div>
  </div>;
}
