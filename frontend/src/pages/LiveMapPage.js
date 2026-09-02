import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapPin } from 'lucide-react';

const LiveMapPage = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLocations = async () => {
    try {
      const response = await axios.get('/api/attendance/live-locations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLocations(response.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError('Gagal mengambil data lokasi.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 30000);
    return () => clearInterval(interval);
  }, []);

  const createIcon = (name) => {
    const iconMarkup = renderToStaticMarkup(
      <div className="flex flex-col items-center text-rose-500">
        <MapPin size={32} />
        <span className="bg-white text-xs font-bold px-1 rounded shadow text-slate-800">
          {name}
        </span>
      </div>
    );

    return L.divIcon({
      html: iconMarkup,
      className: 'custom-leaflet-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  };

  if (loading && locations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Live Tracker (Staff)</h1>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm h-[70vh]">
        <MapContainer center={[-5.147665, 119.432731]} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {locations.map((loc) => (
            <Marker key={loc.user_id} position={[loc.latitude, loc.longitude]} icon={createIcon(loc.username)}>
              <Popup>
                <div className="p-1">
                  <p className="font-bold">{loc.full_name || loc.username}</p>
                  <p className="text-xs text-slate-500">Last Update: {new Date(loc.timestamp).toLocaleString()}</p>
                  {loc.battery_level && <p className="text-xs text-slate-500">Battery: {loc.battery_level}%</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default LiveMapPage;
