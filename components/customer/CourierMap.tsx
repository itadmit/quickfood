"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function makeIcon(html: string) {
  return L.divIcon({
    html,
    className: "qf-courier-pin",
    iconSize: [40, 40],
    iconAnchor: [20, 36],
  });
}

const COURIER_ICON = makeIcon(
  `<div style="
    width:38px;height:38px;border-radius:999px;background:#10b981;
    border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);
    display:grid;place-items:center;color:#fff;font-weight:700;font-size:18px;
  ">●</div>`,
);

const HOUSE_ICON = makeIcon(
  `<div style="
    width:38px;height:38px;border-radius:999px;background:#fff;
    border:3px solid #0b1a14;box-shadow:0 4px 12px rgba(0,0,0,.25);
    display:grid;place-items:center;color:#0b1a14;font-weight:700;font-size:14px;
  ">בית</div>`,
);

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export function CourierMap({
  courier,
  customer,
}: {
  courier: { lat: number; lng: number } | null;
  customer: { lat: number; lng: number } | null;
}) {
  const points = useMemo<Array<[number, number]>>(() => {
    const arr: Array<[number, number]> = [];
    if (courier) arr.push([courier.lat, courier.lng]);
    if (customer) arr.push([customer.lat, customer.lng]);
    return arr;
  }, [courier, customer]);

  if (points.length === 0) return null;

  const center: [number, number] = points[0];

  return (
    <div className="rounded-2xl overflow-hidden border border-qf-line-dash h-[280px]">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {courier && <Marker position={[courier.lat, courier.lng]} icon={COURIER_ICON} />}
        {customer && <Marker position={[customer.lat, customer.lng]} icon={HOUSE_ICON} />}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  );
}
