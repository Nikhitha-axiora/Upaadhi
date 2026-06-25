/* ============================================================================
   Upaadhi — Location picker
   Precise, global location selection using the device GPS, with best-effort
   reverse geocoding (OpenStreetMap Nominatim) to a human-friendly place name.
   Falls back gracefully to coordinates or manual entry when offline/blocked.
   ========================================================================== */
import { Crosshair, Loader2, MapPin, X } from "lucide-react";
import { useState } from "react";
import { Modal, toast } from "./ui";

export interface PlaceSelection {
  label: string;
  lat: number;
  lng: number;
  locality: string;
  city: string;
  /** Present only when derived from a real GPS fix (metres). */
  accuracy?: number;
}

interface NominatimAddress {
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  town?: string;
  city_district?: string;
  county?: string;
  city?: string;
  state_district?: string;
  state?: string;
  country?: string;
}

async function reverseGeocode(lat: number, lng: number): Promise<{ locality: string; city: string; label: string }> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse geocode failed");
  const data = (await res.json()) as { address?: NominatimAddress; display_name?: string };
  const a = data.address ?? {};
  const locality = a.suburb || a.neighbourhood || a.village || a.town || a.city_district || a.county || "";
  const city = a.city || a.town || a.state_district || a.state || "";
  const label = [locality, city].filter(Boolean).join(", ") || data.display_name?.split(",").slice(0, 2).join(",").trim() || "";
  return { locality, city, label };
}

export function LocationPicker({
  open,
  onClose,
  current,
  onSelect
}: {
  open: boolean;
  onClose: () => void;
  current: PlaceSelection | null;
  onSelect: (place: PlaceSelection) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [detected, setDetected] = useState<PlaceSelection | null>(current);
  const [manualLocality, setManualLocality] = useState(current?.locality ?? "");
  const [manualCity, setManualCity] = useState(current?.city ?? "");

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not supported on this device.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(5));
        const lng = Number(position.coords.longitude.toFixed(5));
        const accuracy = Math.round(position.coords.accuracy);
        let locality = "";
        let city = "";
        let label = `${lat}, ${lng}`;
        try {
          const place = await reverseGeocode(lat, lng);
          locality = place.locality;
          city = place.city;
          if (place.label) label = place.label;
        } catch {
          /* offline or blocked — keep coordinate label */
        }
        const selection: PlaceSelection = { label, lat, lng, locality, city, accuracy };
        setDetected(selection);
        if (locality) setManualLocality(locality);
        if (city) setManualCity(city);
        setBusy(false);
        toast.success("Location detected");
      },
      () => {
        setBusy(false);
        toast.error("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  function save() {
    const locality = manualLocality.trim();
    const city = manualCity.trim();
    const label = [locality, city].filter(Boolean).join(", ") || detected?.label || "Selected location";
    const selection: PlaceSelection = {
      label,
      lat: detected?.lat ?? current?.lat ?? 0,
      lng: detected?.lng ?? current?.lng ?? 0,
      locality: locality || detected?.locality || "",
      city: city || detected?.city || "",
      accuracy: detected?.accuracy
    };
    onSelect(selection);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="loc-title">
      <div className="locpick">
        <header className="locpick-head">
          <div className="locpick-title">
            <MapPin size={20} />
            <strong id="loc-title">Set your location</strong>
          </div>
          <button className="kyc-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="locpick-body">
          <button className="primary-button full" type="button" onClick={useCurrentLocation} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : <Crosshair size={18} />}
            Use my current location
          </button>

          {detected && detected.accuracy !== undefined ? (
            <div className="locpick-detected">
              <MapPin size={15} />
              <span>
                {detected.label}
                <em>
                  {" "}
                  · ±{detected.accuracy}m · {detected.lat}, {detected.lng}
                </em>
              </span>
            </div>
          ) : null}

          <div className="locpick-divider">
            <span>or enter manually</span>
          </div>

          <label className="locpick-field">
            Area / locality
            <input value={manualLocality} onChange={(event) => setManualLocality(event.target.value)} placeholder="e.g. Ameerpet" />
          </label>
          <label className="locpick-field">
            City
            <input value={manualCity} onChange={(event) => setManualCity(event.target.value)} placeholder="e.g. Hyderabad" />
          </label>

          <p className="locpick-note">
            <MapPin size={13} /> Precise location is used only to match you with work nearby. The public feed shows
            approximate areas only.
          </p>
        </div>

        <footer className="locpick-foot">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={save}
            disabled={!manualLocality.trim() && !manualCity.trim() && !detected}
          >
            Save location
          </button>
        </footer>
      </div>
    </Modal>
  );
}
