"use client";

import dynamic from "next/dynamic";

/** Leaflet needs the browser, so the tracker is never rendered on the server. */
export const FoodTruckTracker = dynamic(
  () => import("@/components/food-truck-tracker").then((m) => m.FoodTruckTracker),
  { ssr: false, loading: () => <p className="truck-loading">Loading the tracker…</p> },
);
