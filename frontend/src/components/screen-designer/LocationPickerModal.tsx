import { useState, useCallback, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

// Fix Leaflet default marker icon (missing in bundled builds)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LocationResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (location: LocationResult) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  initialLocation?: string;
}

/** Leaflet map managed via refs — avoids react-leaflet's "already initialized" issue */
function LeafletMap({
  lat,
  lng,
  onMapClick,
}: {
  lat: number;
  lng: number;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([lat, lng], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Only run on mount/unmount — lat/lng/onMapClick updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map view and marker when lat/lng change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    mapRef.current.setView([lat, lng], mapRef.current.getZoom());
    markerRef.current.setLatLng([lat, lng]);
  }, [lat, lng]);

  // Keep click handler up to date
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng);
    map.off('click');
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [onMapClick]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}

/** Reverse geocode coordinates to nearest city name via Nominatim */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`;
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    const data = await response.json();
    if (data.address) {
      const city = data.address.city || data.address.town || data.address.village || data.address.hamlet || data.address.municipality || '';
      const country = data.address.country || '';
      if (city) return country ? `${city}, ${country}` : city;
    }
    return '';
  } catch {
    return '';
  }
}

export function LocationPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialLatitude = 52.23,
  initialLongitude = 21.01,
  initialLocation = '',
}: LocationPickerModalProps) {
  const [lat, setLat] = useState(initialLatitude);
  const [lng, setLng] = useState(initialLongitude);
  const [locationName, setLocationName] = useState(initialLocation);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens; delay map mount to ensure DOM is ready
  useEffect(() => {
    if (isOpen) {
      setLat(initialLatitude);
      setLng(initialLongitude);
      setLocationName(initialLocation);
      setSearchQuery('');
      setSearchResults([]);
      setMapMounted(false);
      // Small delay so Modal DOM is painted before Leaflet initializes
      const t = setTimeout(() => setMapMounted(true), 50);
      return () => clearTimeout(t);
    } else {
      setMapMounted(false);
    }
  }, [isOpen, initialLatitude, initialLongitude, initialLocation]);

  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.results && Array.isArray(data.results)) {
        setSearchResults(data.results.map((r: { name: string; country?: string; latitude: number; longitude: number }) => ({
          name: r.name,
          country: r.country || '',
          latitude: r.latitude,
          longitude: r.longitude,
        })));
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchLocations(value), 300);
  };

  const handleSelectResult = (result: LocationResult) => {
    setLat(result.latitude);
    setLng(result.longitude);
    setLocationName(`${result.name}, ${result.country}`);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleMapClick = useCallback((clickLat: number, clickLng: number) => {
    setLat(clickLat);
    setLng(clickLng);
    setLocationName(`${clickLat.toFixed(4)}, ${clickLng.toFixed(4)}`);
    // Reverse geocode to find nearest city
    setIsReversing(true);
    reverseGeocode(clickLat, clickLng).then((name) => {
      if (name) setLocationName(name);
      setIsReversing(false);
    });
  }, []);

  const handleConfirm = () => {
    const parts = locationName.split(', ');
    const name = parts[0] || locationName;
    const country = parts.slice(1).join(', ');
    onSelect({ name, country, latitude: lat, longitude: lng });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Location"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm Location</Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Search input — above the map */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search for a city..."
            className="w-full px-3 py-2 text-sm border border-border-default rounded-lg bg-bg-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="absolute w-full mt-1 bg-bg-card border border-border-light rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ zIndex: 1100 }}>
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent-light transition-colors border-b border-border-light last:border-b-0"
                >
                  <span className="font-medium">{result.name}</span>
                  <span className="text-text-muted ml-1">{result.country}</span>
                  <span className="text-xs text-text-placeholder ml-2">
                    ({result.latitude.toFixed(2)}, {result.longitude.toFixed(2)})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="rounded-lg overflow-hidden border border-border-default" style={{ height: '350px' }}>
          {mapMounted && (
            <LeafletMap lat={lat} lng={lng} onMapClick={handleMapClick} />
          )}
        </div>

        {/* Selected location info */}
        <div className="flex items-center justify-between px-1 text-sm">
          <span className="text-text-secondary font-medium">
            {isReversing ? (
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin text-text-muted" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Finding nearest city...
              </span>
            ) : (
              locationName || 'Click on the map or search for a location'
            )}
          </span>
          <span className="text-text-muted text-xs">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </span>
        </div>
      </div>
    </Modal>
  );
}
