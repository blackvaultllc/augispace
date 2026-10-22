"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  Upload,
} from "lucide-react";

type Asset = {
  placement: string;
  url: string;
  kind: "image" | "video";
  updated_at: string;
};

const SLOTS = [
  {
    key: "truck_hero_video",
    label: "Food truck hero — VIDEO",
    hint: 'MP4/WebM, up to 63 MB. Plays behind "The street-food radar." heading.',
  },
  {
    key: "truck_hero_image",
    label: "Food truck hero — poster image",
    hint: "Shown until/unless a video is set. JPG/PNG/WebP.",
  },
  {
    key: "live_counts_image",
    label: "Live sections — side image",
    hint: "Vibrant image shown next to live counters/stats.",
  },
] as const;

export function MediaUploader() {
  const [assets, setAssets] = useState<Record<string, Asset>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/media", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { assets?: Asset[] };
      const map: Record<string, Asset> = {};
      for (const asset of data.assets ?? []) map[asset.placement] = asset;
      setAssets(map);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(slot: string, file: File) {
    setBusySlot(slot);
    setMessages((m) => ({ ...m, [slot]: "" }));
    try {
      const form = new FormData();
      form.set("placement", slot);
      form.set("file", file);
      const response = await fetch("/api/media", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };
      setMessages((m) => ({
        ...m,
        [slot]: response.ok
          ? (payload.message ?? "Uploaded.")
          : (payload.error ?? "Upload failed."),
      }));
      if (response.ok) void load();
    } catch {
      setMessages((m) => ({ ...m, [slot]: "Upload failed." }));
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <section
      className="admin-panel admin-media-panel"
      aria-labelledby="media-title"
    >
      <div className="admin-panel-head">
        <Upload aria-hidden="true" />
        <h3 id="media-title">Site media</h3>
      </div>
      <p className="admin-panel-note">
        Upload pictures and videos to public page slots. Files are stored in
        your project&apos;s storage bucket — no external service needed.
      </p>
      {SLOTS.map((slot) => {
        const asset = assets[slot.key];
        return (
          <div className="admin-media-slot" key={slot.key}>
            <div className="admin-integration-head">
              <strong>{slot.label}</strong>
              {asset && (
                <span className="admin-badge ok">
                  {asset.kind === "video" ? "VIDEO LIVE" : "IMAGE LIVE"}
                </span>
              )}
            </div>
            <small className="admin-media-hint">{slot.hint}</small>
            {asset &&
              (asset.kind === "video" ? (
                <video
                  src={asset.url}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="admin-media-preview"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.url} alt="" className="admin-media-preview" />
              ))}
            <div className="admin-integration-actions">
              <button
                type="button"
                disabled={busySlot === slot.key}
                onClick={() => inputs.current[slot.key]?.click()}
              >
                {busySlot === slot.key ? (
                  <LoaderCircle className="spin-icon" aria-hidden="true" />
                ) : asset?.kind === "video" ? (
                  <Film aria-hidden="true" />
                ) : (
                  <ImageIcon aria-hidden="true" />
                )}
                {asset ? "Replace" : "Upload"}
              </button>
              {asset && (
                <a
                  className="admin-media-link"
                  href={asset.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
              )}
            </div>
            <input
              ref={(el) => {
                inputs.current[slot.key] = el;
              }}
              type="file"
              accept={slot.key.endsWith("_video") ? "video/*" : "image/*"}
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(slot.key, file);
                event.target.value = "";
              }}
            />
            {messages[slot.key] && (
              <p className="admin-media-msg" role="status">
                <CheckCircle2 aria-hidden="true" /> {messages[slot.key]}
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
