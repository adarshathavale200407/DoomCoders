import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

const pin = L.divIcon({
  className: "",
  iconSize: [30, 38],
  iconAnchor: [15, 38],
  html: `<svg width="30" height="38" viewBox="0 0 24 30"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 18 12 18s12-9 12-18C24 5.4 18.6 0 12 0z" fill="#e4572e" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`,
});

/** Read-only map with a single pin. */
export default function StaticMap({ lat, lng }) {
  return (
    <div className="isolate h-56 overflow-hidden rounded-xl border border-line">
      <MapContainer key={`${lat},${lng}`} center={[lat, lng]} zoom={16} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={pin} />
      </MapContainer>
    </div>
  );
}
