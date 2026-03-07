import { useEffect, useRef } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  Circle,
} from "@react-google-maps/api";

type UserLocation = {
  id: string;
  latitude: number;
  longitude: number;
  email: string;
};

type Props = {
  usersLocation: UserLocation[];
  position: [number, number] | null;
};

const containerStyle = {
  width: "100%",
  height: "83vh",
  borderRadius: "10px",
};

const GEOFENCE_CENTER = {
  lat: 11.2588,
  lng: 75.7804,
};

const GEOFENCE_RADIUS = 500; // meters

const isValid = (lat: unknown, lng: unknown) =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  !isNaN(lat) &&
  !isNaN(lng);

// Haversine formula
const isOutsideGeofence = (
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  radius: number
) => {
  const R = 6371000;
  const dLat = ((lat - centerLat) * Math.PI) / 180;
  const dLng = ((lng - centerLng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((centerLat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance > radius;
};

const MapComponent = ({ usersLocation, position }: Props) => {
  const mapRef = useRef<google.maps.Map | null>(null);

  const myLat = position?.[0];
  const myLng = position?.[1];

  /* =============================
     CENTER MAP WHEN POSITION UPDATES
  ============================== */
  useEffect(() => {
    if (!mapRef.current || !position) return;

    mapRef.current.panTo({
      lat: position[0],
      lng: position[1],
    });
  }, [position]);

  /* =============================
     EXIT DETECTION (ADMIN)
  ============================== */
  useEffect(() => {
    if (!position || !isValid(myLat, myLng)) return;

    const outside = isOutsideGeofence(
      myLat!,
      myLng!,
      GEOFENCE_CENTER.lat,
      GEOFENCE_CENTER.lng,
      GEOFENCE_RADIUS
    );

    if (outside) {
      console.log("🚨 Admin left geofence");
    }
  }, [position]);

  /* =============================
     EXIT DETECTION (STUDENTS)
  ============================== */
  useEffect(() => {
    if (!usersLocation) return;

    usersLocation.forEach((user) => {
      if (!isValid(user.latitude, user.longitude)) return;

      const outside = isOutsideGeofence(
        user.latitude,
        user.longitude,
        GEOFENCE_CENTER.lat,
        GEOFENCE_CENTER.lng,
        GEOFENCE_RADIUS
      );

      if (outside) {
        console.log(`🚨 ${user.email} left geofence`);
      }
    });
  }, [usersLocation]);

  return (
    <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={position ? { lat: myLat!, lng: myLng! } : GEOFENCE_CENTER}
        zoom={15}
        onLoad={(map) => (mapRef.current = map)}
        mapTypeId="satellite"
      >
        {/* 🔵 ADMIN MARKER */}
        {position && isValid(myLat, myLng) && (
          <Marker
            position={{ lat: myLat!, lng: myLng! }}
            icon={{
              url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            }}
          />
        )}

        {/* 🔴 STUDENT MARKERS */}
        {usersLocation?.map((user) =>
          isValid(user.latitude, user.longitude) ? (
            <Marker
              key={user.id}
              position={{
                lat: user.latitude,
                lng: user.longitude,
              }}
              icon={{
                url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
              }}
            />
          ) : null
        )}

        {/* 🟠 GEOFENCE */}
        <Circle
          center={GEOFENCE_CENTER}
          radius={GEOFENCE_RADIUS}
          options={{
            fillColor: "#FF0000",
            fillOpacity: 0.15,
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 2,
          }}
        />
      </GoogleMap>
    </LoadScript>
  );
};

export default MapComponent;