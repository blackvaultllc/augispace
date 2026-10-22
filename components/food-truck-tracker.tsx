"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  MapPin,
  MessageSquare,
  Navigation,
  Radio,
  Star,
  Truck,
  UtensilsCrossed,
  LoaderCircle,
  CircleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TruckComment = {
  id: string;
  body: string;
  emoji: string | null;
  createdAt: string;
};
type TruckLocation = {
  latitude: number;
  longitude: number;
  placeNote: string | null;
  active: boolean;
  updatedAt: string;
};
type Truck = {
  id: string;
  businessName: string;
  cuisine: string | null;
  description: string | null;
  truckPhotoUrl: string | null;
  menuPhotoUrl: string | null;
  verified: boolean;
  location: TruckLocation | null;
  comments: TruckComment[];
};

const MAP_W = 800;
const MAP_H = 420;
const project = (lat: number, lon: number): [number, number] => [
  ((lon + 180) / 360) * MAP_W,
  ((90 - lat) / 180) * MAP_H,
];

export function FoodTruckTracker({
  signedIn,
  isOperator,
}: {
  signedIn: boolean;
  isOperator: boolean;
}) {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/food-trucks", { cache: "no-store" });
      const payload = (await response.json()) as {
        trucks?: Truck[];
        error?: string;
      };
      if (!response.ok || payload.error) {
        setError(payload.error || "The tracker is temporarily unavailable.");
        return;
      }
      setTrucks(payload.trucks ?? []);
      setError("");
    } catch {
      setError("The tracker is temporarily unavailable.");
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

  async function postComment(event: FormEvent) {
    event.preventDefault();
    if (!selected || !commentDraft.trim()) return;
    setCommentError("");
    const response = await fetch("/api/food-trucks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "comment",
        truckId: selected.id,
        body: commentDraft,
      }),
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
    <div className="truck-tracker">
      <div className="truck-tracker-head">
        <span className="truck-live">
          <Radio aria-hidden="true" /> {active.length} TRUCK
          {active.length === 1 ? "" : "S"} LIVE NOW
        </span>
        <span className="truck-refresh-note">
          Locations refresh every minute
        </span>
      </div>
      {error && (
        <p className="truck-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="truck-loading">Loading the tracker…</p>}

      {!loading && (
        <div className="truck-layout">
          <div
            className="truck-map"
            role="img"
            aria-label={`Map showing ${active.length} food trucks`}
          >
            <div className="truck-map-grid" aria-hidden="true" />
            {active.map((truck) => {
              const [x, y] = project(
                truck.location!.latitude,
                truck.location!.longitude,
              );
              return (
                <button
                  type="button"
                  key={truck.id}
                  className={`truck-pin${selectedId === truck.id ? " is-selected" : ""}`}
                  style={{
                    left: `${(x / MAP_W) * 100}%`,
                    top: `${(y / MAP_H) * 100}%`,
                  }}
                  onClick={() => setSelectedId(truck.id)}
                  aria-label={`${truck.businessName} at ${truck.location!.placeNote ?? "map location"}`}
                >
                  <Truck aria-hidden="true" />
                </button>
              );
            })}
            {!active.length && (
              <p className="truck-map-empty">
                No trucks are live right now. Operators check in when they open
                for service.
              </p>
            )}
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
                      <Star aria-hidden="true" /> LICENSE VERIFIED
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
            {!trucks.length && (
              <p className="truck-empty">
                No trucks registered yet. Operators can{" "}
                <Link href="/sign-up">create an account</Link> and register.
              </p>
            )}
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
              <h3>{selected.businessName}</h3>
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
                {selected.location.placeNote ?? "Live now"} · updated{" "}
                {new Date(selected.location.updatedAt).toLocaleTimeString()}
              </span>
            )}
          </header>
          <div className="truck-photos">
            {selected.truckPhotoUrl && (
              <img
                src={selected.truckPhotoUrl}
                alt={`Truck photo for ${selected.businessName}`}
                width={280}
                height={180}
              />
            )}
            {selected.menuPhotoUrl && (
              <img
                src={selected.menuPhotoUrl}
                alt={`Menu photo for ${selected.businessName}`}
                width={280}
                height={180}
              />
            )}
            {!selected.truckPhotoUrl && !selected.menuPhotoUrl && (
              <p className="truck-no-photos">
                The operator has not added photos yet.
              </p>
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
            {selected.comments.map((comment) => (
              <div className="truck-comment" key={comment.id}>
                {comment.emoji && (
                  <span className="truck-comment-emoji">{comment.emoji}</span>
                )}
                <p>{comment.body}</p>
                <time>{new Date(comment.createdAt).toLocaleDateString()}</time>
              </div>
            ))}
            {signedIn ? (
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
                <Link href="/sign-in">Sign in</Link> to leave comments and
                reactions.
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
          You have an operator account — manage your truck listing and live
          location from your workspace.
        </p>
      )}
    </div>
  );
}
