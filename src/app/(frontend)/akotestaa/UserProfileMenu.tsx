'use client';

import React, { useState, useEffect } from 'react';

interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

interface SavedLocation {
  address: string;
  lat: number;
  lng: number;
}

interface UserProfileMenuProps {
  userName: string;
  onLocationSaved?: (location: SavedLocation) => void;
}

export default function UserProfileMenu({
  userName,
  onLocationSaved,
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [savedLocation, setSavedLocation] = useState<SavedLocation | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Ladataan mahdollinen aiemmin tallennettu kotialue selaimen muistista
  useEffect(() => {
    const stored = localStorage.getItem('user_home_location');
    if (stored) {
      const parsed = JSON.parse(stored);
      setSavedLocation(parsed);
      setQuery(parsed.address);
    }
  }, []);

  // Haetaan osoite-ehdotukset ilmaisesta Photon-rajapinnasta (OpenStreetMap)
  useEffect(() => {
    if (query.trim().length < 3 || savedLocation?.address === query) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Rajataan haku Suomeen (bbox) ja painotetaan pääkaupunkiseutua
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          query
        )}&limit=5&bbox=19.0,59.5,31.6,70.1&lat=60.2055&lon=24.6559`;

        const res = await fetch(url);
        const data = await res.json();

        const results: AddressSuggestion[] = (data.features || []).map((f: any) => {
          const p = f.properties;
          const street = [p.street, p.housenumber].filter(Boolean).join(' ');
          const city = p.city || p.town || p.village || p.municipality || '';
          const name = p.name && p.name !== street ? p.name : '';
          const label = [name, street, p.postcode, city].filter(Boolean).join(', ');

          return {
            label: label || 'Tuntematon osoite',
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
          };
        });

        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350); // 350 ms viive estää turhat kutsut kirjoittaessa

    return () => clearTimeout(timer);
  }, [query, savedLocation]);

  const handleSelectAddress = (item: AddressSuggestion) => {
    const newLoc: SavedLocation = {
      address: item.label,
      lat: item.lat,
      lng: item.lng,
    };
    setSavedLocation(newLoc);
    setQuery(item.label);
    setSuggestions([]);
    localStorage.setItem('user_home_location', JSON.stringify(newLoc));

    // Välitetään koordinaatit yläkomponentille (esim. kartalle tai Payload API:lle)
    if (onLocationSaved) {
      onLocationSaved(newLoc);
    }
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', fontFamily: 'sans-serif' }}>
      {/* Käyttäjän nimi -painike yläpalkissa */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: '999px',
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
          color: '#0f172a',
        }}
      >
        <span>{userName}</span>
        <span style={{ fontSize: '11px', color: '#64748b' }}>
          {savedLocation ? `(${savedLocation.address.split(',')[0]})` : '• Lisää osoite'}
        </span>
        <span>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Avautuva profiilivalikko */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            marginTop: '8px',
            width: '320px',
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            border: '1px solid #e2e8f0',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
            Profiilitiedot ja kotialue
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
            Käytetään lähialueen tapahtumien ja kartan keskittämiseen.
          </div>

          <label
            htmlFor="home-address-input"
            style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}
          >
            Kotiosoite tai kaupunginosa
          </label>

          {/* Tapa 3 mukana: name="street-address" ja autoComplete="street-address" 
              aktivoivat selaimen / Google-tilin oman osoite-ehdotuksen */}
          <input
            id="home-address-input"
            name="street-address"
            type="text"
            autoComplete="street-address"
            placeholder="Kirjoita osoite tai esim. Leppävaara..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (savedLocation) setSavedLocation(null);
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid #94a3b8',
              fontSize: '14px',
            }}
          />

          {isSearching && (
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              Haetaan osoitteita...
            </div>
          )}

          {/* Tapa 2: Photon / OpenStreetMap -pudotusvalikko koordinaateilla */}
          {suggestions.length > 0 && (
            <ul
              style={{
                listStyle: 'none',
                margin: '6px 0 0 0',
                padding: 0,
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                maxHeight: '180px',
                overflowY: 'auto',
                background: '#f8fafc',
              }}
            >
              {suggestions.map((item, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    onClick={() => handleSelectAddress(item)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      border: 'none',
                      borderBottom: idx < suggestions.length - 1 ? '1px solid #e2e8f0' : 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#1e293b',
                    }}
                  >
                    📍 {item.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {savedLocation && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 10px',
                background: '#eff6ff',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#1d4ed8',
              }}
            >
              Tallennettu: {savedLocation.lat.toFixed(4)}, {savedLocation.lng.toFixed(4)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}