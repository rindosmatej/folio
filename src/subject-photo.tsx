import React, { useEffect, useState } from "react";
import { subjectCover } from "./api";
export function SubjectPhoto({
  cover,
  photo,
  change,
}: {
  cover?: string;
  photo: File | null;
  change: (f: File | null) => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!photo) {
      setUrl("");
      return;
    }
    const local = URL.createObjectURL(photo);
    setUrl(local);
    return () => URL.revokeObjectURL(local);
  }, [photo]);
  return (
    <fieldset className="subject-photo">
      <legend>Úvodní fotografie</legend>
      {(url || cover) && (
        <img
          src={url || (cover ? subjectCover(cover) : "")}
          alt="Náhled úvodní fotografie předmětu"
        />
      )}
      <label>
        Vybrat fotografii
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            if (f && f.size > 4 * 1024 * 1024) {
              setError("Soubor je větší než 4 MB.");
              e.target.value = "";
              change(null);
            } else {
              setError("");
              change(f);
            }
          }}
        />
      </label>
      <small>JPG, PNG nebo WebP · nejvýše 4 MB</small>
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}
export async function saveWithPhoto(data: any, photo: File) {
  const body = new FormData();
  body.append("subject", JSON.stringify(data));
  body.append("photo", photo);
  const res = await fetch("/api/subject-photo", { method: "POST", body });
  const value = await res.json();
  if (!res.ok) throw Error(value.error);
  return value;
}
