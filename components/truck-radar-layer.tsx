"use client";

import { useEffect, useRef } from "react";
import { Marker, Popup, useMap } from "react-leaflet";
import { divIcon, type DivIcon, type Marker as LeafletMarker } from "leaflet";
import type { Truck } from "@/lib/food-truck-types";

type PinStatus = "open" | "closed" | "pending";

const PERIOD_MS = 7000;

const STATUS_LABEL: Record<PinStatus, string> = {
  open: "Open now",
  closed: "Closed",
  pending: "Pending - license not verified yet",
};

function statusOf(truck: Truck): PinStatus {
  if (!truck.location?.active) return "closed";
  return truck.verified ? "open" : "pending";
}

const iconCache = new Map<string, DivIcon>();

function pinIcon(status: PinStatus, selected: boolean): DivIcon {
  const key = `${status}-${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = divIcon({
      className: `truck-pin truck-pin-${status}${selected ? " is-selected" : ""}`,
      html: '<span class="truck-pin-ring"></span><span class="truck-pin-dot"></span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

type Props = {
  trucks: Truck[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function TruckPins({ trucks, selectedId, onSelect }: Props) {
  const map = useMap();
  const markers = useRef(new Map<string, LeafletMarker>());
  const latest = useRef(trucks);

  useEffect(() => {
    latest.current = trucks;
  });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sweep = map
      .getContainer()
      .parentElement?.querySelector<HTMLElement>(".truck-radar-sweep");
    const lastBehind = new Map<string, number>();
    let frame = 0;

    const tick = (time: number) => {
      // 0 = north, clockwise. The bright edge of the sweep leads at this bearing.
      const angle = ((time % PERIOD_MS) / PERIOD_MS) * 360;
      if (sweep) sweep.style.rotate = `${angle}deg`;

      const size = map.getSize();
      const cx = size.x / 2;
      const cy = size.y / 2;

      for (const truck of latest.current) {
        if (!truck.location) continue;
        const element = markers.current.get(truck.id)?.getElement();
        if (!element) continue;

        const point = map.latLngToContainerPoint([
          truck.location.latitude,
          truck.location.longitude,
        ]);
        const bearing =
          ((Math.atan2(point.x - cx, -(point.y - cy)) * 180) / Math.PI + 360) % 360;
        const behind = (angle - bearing + 360) % 360;

        element.style.setProperty("--glow", String(Math.max(0.2, 1 - behind / 300)));

        const previous = lastBehind.get(truck.id);
        if (previous !== undefined && previous - behind > 180) {
          element.classList.remove("is-pinging");
          void element.offsetWidth;
          element.classList.add("is-pinging");
        }
        lastBehind.set(truck.id, behind);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [map]);

  return (
    <>
      {trucks.map((truck) => {
        if (!truck.location) return null;
        const status = statusOf(truck);
        return (
          <Marker
            key={truck.id}
            position={[truck.location.latitude, truck.location.longitude]}
            icon={pinIcon(status, selectedId === truck.id)}
            ref={(marker) => {
              if (marker) markers.current.set(truck.id, marker);
              else markers.current.delete(truck.id);
            }}
            eventHandlers={{ click: () => onSelect(truck.id) }}
          >
            <Popup>
              <strong>{truck.businessName}</strong>
              <br />
              {truck.location.placeNote ?? truck.cuisine ?? "Food truck"}
              <br />
              {STATUS_LABEL[status]}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}