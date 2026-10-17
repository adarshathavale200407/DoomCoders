import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

// Custom SVG pin: avoids Leaflet's default marker images, which break under Vite.
const pin = L.divIcon({
  className: "",
  iconSize: [30, 38],
  iconAnchor: [15, 38],
  html: `<svg width="30" height="38" viewBox="0 0 24 30"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 18 12 18s12-9 12-18C24 5.4 18.6 0 12 0z" fill="#e4572e" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
});

const INDIA = [20.59, 78.96];

function ClickToPlace({ onChange }) {
  useMapEvents({ click: (e) => onChange({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Fly to a new spot when `focus` changes (search / "use my location")
function FlyTo({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], focus.zoom ?? 17, { duration: 0.8 });
  }, [focus, map]);
  return null;
}

/**
 * position: { lat, lng } | null     onChange({ lat, lng })
 * focus:    { lat, lng, zoom }      change it to move the camera
 */
export default function MapPicker({ position, onChange, focus }) {
  const start = position ? [position.lat, position.lng] : INDIA;
  return (
    // `isolate` keeps Leaflet's high z-indexes below the sticky navbar
    <div className="isolate h-72 overflow-hidden rounded-xl border border-line sm:h-80">
      <MapContainer center={start} zoom={position ? 17 : 5} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onChange={onChange} />
        <FlyTo focus={focus} />
        {position && (
          <Marker
            position={[position.lat, position.lng]}
            icon={pin}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onChange({ lat, lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
