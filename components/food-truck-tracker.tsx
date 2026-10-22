"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CircleAlert,
  MapPin,
  MessageSquare,
  Navigation,
  Radio,
  Star,
  Truck as TruckIcon,
  UtensilsCrossed,
} from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Truck } from "@/lib/food-truck-types";
import { DEMO_TRUCKS, isDemoTruck } from "@/lib/food-truck-demo";

type TruckComment = Truck["comments"][number];

type Props = { signedIn: boolean; isOperator: boolean };

/** Recenters the map when a truck is selected from the list. */
function FlyTo({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([latitude, longitude], 16, { duration: 1.1 });
  }, [latitude, longitude, map]);
  return null;
}

export function FoodTruckTracker({ signedIn, isOperator }: Props) {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [liveUnavailable, setLiveUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/food-trucks", { cache: "no-store" });
      const payload = (await response.json()) as { trucks?: Truck[]; error?: string };
      if (!response.ok || payload.error) {
        // API or database not ready yet — fall back to the demo fleet so the
        // public always sees how the tracker works.
        setTrucks(DEMO_TRUCKS);
        setLiveUnavailable(true);
        setLoading(false);
        return;
      }
      const fetched = payload.trucks ?? [];
      if (!fetched.length) {
        setTrucks(DEMO_TRUCKS);
        setLiveUnavailable(true);
      } else {
        setTrucks(fetched);
        setLiveUnavailable(false);
      }
      setError("");
    } catch {
      setTrucks(DEMO_TRUCKS);
      setLiveUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const active = useMemo(
    () => trucks.filter((truck) => truck.location?.active),
    [trucks],
  );
  const selected = trucks.find((truck) => truck.id === selectedId) ?? null;
  const demoMode = liveUnavailable || (trucks.length > 0 && trucks.every(isDemoTruck));

  async function postComment(event: FormEvent) {
    event.preventDefault();
    if (!selected || !commentDraft.trim()) return;
    if (isDemoTruck(selected)) {
      setCommentError("This is a demo listing — comments open on real trucks. Create an account to be first in line!");
      return;
    }
    setCommentError("");
    const response = await fetch("/api/food-trucks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "comment", truckId: selected.id, body: commentDraft }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setCommentError(payload.error || "The comment could not be posted.");
      return;
    }
    setCommentDraft("");
    void load();
  }

  return (
    <div className="truck-tracker" aria-live="polite">
      <div className="truck-tracker-head">
        <span className="truck-live">
          <Radio aria-hidden="true" /> {active.length} TRUCK{active.length === 1 ? "" : "S"} ON THE MAP
        </span>
        <img className="truck-live-thumb" src="/augi-community-research.png" alt="" aria-hidden="true" />
        <span className="truck-refresh-note">
          Zoom in for street-level detail · refreshes every minute
        </span>
      </div>

      {demoMode && (
        <p className="truck-demo-banner" role="status">
          <Star aria-hidden="true" /> DEMO PREVIEW — sample trucks so you can see
          how the tracker works. Operators: register your truck to appear live
          here for free.
        </p>
      )}
      {error && !demoMode && (
        <p className="truck-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="truck-loading">Loading the tracker…</p>}

      {!loading && (
        <div className="truck-layout">
          <div className="truck-map-shell">
            <MapContainer
              center={[30.6954, -88.0399]}
              zoom={13}
              scrollWheelZoom
              className="truck-map"
              aria-label="Food truck map with street-level detail"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {active.map((truck) =>
                truck.location ? (
                  <CircleMarker
                    key={truck.id}
                    center={[truck.location.latitude, truck.location.longitude]}
                    radius={selectedId === truck.id ? 12 : 8}
                    pathOptions={{
                      color: selectedId === truck.id ? "#ff4545" : "#ff7777",
                      fillColor: selectedId === truck.id ? "#ff4545" : "#ff7777",
                      fillOpacity: 0.85,
                      weight: 2,
                    }}
                    eventHandlers={{ click: () => setSelectedId(truck.id) }}
                  >
                    <Popup>
                      <strong>{truck.businessName}</strong>
                      <br />
                      {truck.location.placeNote ?? truck.cuisine ?? "Food truck"}
                      <br />
                      {truck.verified ? "✅ License verified" : "License verification pending"}
                    </Popup>
                  </CircleMarker>
                ) : null,
              )}
              {selected?.location?.active && (
                <FlyTo
                  latitude={selected.location.latitude}
                  longitude={selected.location.longitude}
                />
              )}
            </MapContainer>
            <div className="truck-radar-overlay" aria-hidden="true">
              <span className="truck-radar-ring truck-radar-ring-1" />
              <span className="truck-radar-ring truck-radar-ring-2" />
              <span className="truck-radar-ring truck-radar-ring-3" />
              <span className="truck-radar-axis truck-radar-axis-h" />
              <span className="truck-radar-axis truck-radar-axis-v" />
              <span className="truck-radar-sweep" />
            </div>
          </div>

          <aside className="truck-list" aria-label="Food trucks">
            {trucks.map((truck) => (
              <button
                type="button"
                key={truck.id}
                className={`truck-card${selectedId === truck.id ? " is-selected" : ""}`}
                onClick={() => setSelectedId(truck.id)}
              >
                <div className="truck-card-head">
                  <strong>{truck.businessName}</strong>
                  {truck.verified && (
                    <span className="truck-verified">
                      <Star aria-hidden="true" /> VERIFIED
                    </span>
                  )}
                </div>
                {truck.cuisine && (
                  <span className="truck-cuisine">
                    <UtensilsCrossed aria-hidden="true" /> {truck.cuisine}
                  </span>
                )}
                {truck.location?.active && (
                  <span className="truck-where">
                    <MapPin aria-hidden="true" />{" "}
                    {truck.location.placeNote ?? "Live on map"}
                  </span>
                )}
              </button>
            ))}
          </aside>
        </div>
      )}

      {selected && (
        <section
          className="truck-profile"
          aria-label={`${selected.businessName} profile`}
        >
          <header className="truck-profile-head">
            <div>
              <h3>
                {selected.businessName}
                {isDemoTruck(selected) && (
                  <em className="truck-demo-tag">DEMO</em>
                )}
              </h3>
              <span>
                {selected.cuisine ?? "Food truck"} ·{" "}
                {selected.verified
                  ? "License verified"
                  : "License verification pending"}
              </span>
            </div>
            {selected.location?.active && (
              <span className="truck-profile-where">
                <Navigation aria-hidden="true" />{" "}
                {selected.location.placeNote ?? "Live now"}
              </span>
            )}
          </header>
          <div className="truck-photos">
            {selected.truckPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.truckPhotoUrl}
                alt={`Truck photo for ${selected.businessName}`}
                width={280}
                height={180}
              />
            ) : (
              <div className="truck-photo-slot" aria-hidden="true">
                <TruckIcon /> Truck photo placeholder
              </div>
            )}
            {selected.menuPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.menuPhotoUrl}
                alt={`Menu photo for ${selected.businessName}`}
                width={280}
                height={180}
              />
            ) : (
              <div className="truck-photo-slot" aria-hidden="true">
                🍽️ Menu photo placeholder
              </div>
            )}
          </div>
          {selected.description && (
            <p className="truck-description">{selected.description}</p>
          )}

          <div className="truck-comments">
            <h4>
              <MessageSquare aria-hidden="true" /> Community (
              {selected.comments.length})
            </h4>
            {selected.comments.map((comment: TruckComment) => (
              <div className="truck-comment" key={comment.id}>
                {comment.emoji && (
                  <span className="truck-comment-emoji">{comment.emoji}</span>
                )}
                <p>{comment.body}</p>
                <time>{new Date(comment.createdAt).toLocaleDateString()}</time>
              </div>
            ))}
            {signedIn && !isDemoTruck(selected) ? (
              <form className="truck-comment-form" onSubmit={postComment}>
                <input
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Say something nice or drop an emoji 🌮"
                  maxLength={400}
                  aria-label={`Comment on ${selected.businessName}`}
                />
                <button type="submit">Post</button>
              </form>
            ) : (
              <p className="truck-comment-signin">
                {isDemoTruck(selected)
                  ? "Demo listing — real trucks open for comments once registered."
                  : (
                      <Link href="/sign-in">Sign in</Link>
                    )}{" "}
                {!(isDemoTruck(selected)) && "to leave comments and reactions."}
              </p>
            )}
            {commentError && (
              <p className="truck-comment-error" role="alert">
                <CircleAlert aria-hidden="true" /> {commentError}
              </p>
            )}
          </div>
        </section>
      )}

      {isOperator && (
        <p className="truck-operator-note">
          You are signed in — register your truck from your workspace to appear
          on the public map.
        </p>
      )}
    </div>
  );
}

