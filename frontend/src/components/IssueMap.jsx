import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import { CATEGORY_ICON } from "../lib/format.js";
import { PriorityBadge, StatusBadge } from "./Badges.jsx";

export const PRIORITY_COLORS = {
  Critical: "#c62828",
  High: "#e4572e",
  Medium: "#d99a00",
  Low: "#4f8f6f",
  Closed: "#8a948f",
};

const iconCache = new Map();
function markerIcon(label, category, selected) {
  const key = `${label}|${category}|${selected}`;
  if (!iconCache.has(key)) {
    const size = selected ? 42 : 32;
    iconCache.set(
      key,
      L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${PRIORITY_COLORS[label] || "#8a948f"};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:${selected ? 20 : 15}px;${selected ? "outline:3px solid rgba(31,111,92,.5);" : ""}">${CATEGORY_ICON[category] || "📍"}</div>`,
      })
    );
  }
  return iconCache.get(key);
}

const youIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)"></div>`,
});

// Frame the user's search area, or all markers when there is no location
function Fit({ items, user, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    if (user && radiusKm) {
      map.fitBounds(L.latLng(user.lat, user.lng).toBounds(radiusKm * 2000));
    } else if (user) {
      map.flyTo([user.lat, user.lng], 14);
    } else if (items.length) {
      const bounds = L.latLngBounds(items.map((i) => [i.location.lat, i.location.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [items, user, radiusKm, map]);
  return null;
}

// Zoom to an issue picked from the side list and open its popup
function FlyToSelected({ selected, items, markerRefs }) {
  const map = useMap();
  useEffect(() => {
    if (!selected) return;
    const issue = items.find((i) => i.id === selected.id);
    if (!issue) return;
    map.flyTo([issue.location.lat, issue.location.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    const t = setTimeout(() => markerRefs.current[issue.id]?.openPopup(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  return null;
}

/**
 * items: issues from GET /issues
 * user: { lat, lng } | null    radiusKm: number | null
 * selected: { id, n } | null   onSelect(id)
 */
export default function IssueMap({ items, user, radiusKm, selected, onSelect }) {
  const markerRefs = useRef({});

  return (
    <MapContainer center={[20.59, 78.96]} zoom={5} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit items={items} user={user} radiusKm={radiusKm} />
      <FlyToSelected selected={selected} items={items} markerRefs={markerRefs} />

      {user && radiusKm && (
        <Circle center={[user.lat, user.lng]} radius={radiusKm * 1000}
                pathOptions={{ color: "#2563eb", weight: 1.5, fillOpacity: 0.05 }} />
      )}
      {user && <Marker position={[user.lat, user.lng]} icon={youIcon} interactive={false} />}

      {items.map((issue) => {
        const isSelected = selected?.id === issue.id;
        return (
          <Marker
            key={issue.id}
            position={[issue.location.lat, issue.location.lng]}
            icon={markerIcon(issue.priority.label, issue.category, isSelected)}
            zIndexOffset={isSelected ? 1000 : Math.round(issue.priority.score)}
            ref={(m) => {
              if (m) markerRefs.current[issue.id] = m;
            }}
            eventHandlers={{ click: () => onSelect(issue.id) }}
          >
            <Popup minWidth={220} maxWidth={260}>
              <div className="space-y-2 font-sans">
                <div className="flex flex-wrap gap-1.5">
                  <PriorityBadge priority={issue.priority} />
                  <StatusBadge status={issue.status} />
                </div>
                <p className="font-display text-base font-bold leading-snug">{issue.title}</p>
                <p className="line-clamp-3 text-xs text-muted">{issue.description}</p>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{issue.category_label}</span>
                  <span>▲ {issue.upvotes}</span>
                </div>
                <Link to={`/issues/${issue.id}`} className="block rounded-lg bg-brand py-1.5 text-center text-sm font-semibold !text-white">
                  View details →
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
