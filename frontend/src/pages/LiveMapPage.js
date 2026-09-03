import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { Camera, Server, Megaphone, Users, Navigation, Activity } from 'lucide-react';
import { useApp } from '../context/AppContext';
import WebRTCPlayer from '../components/WebRTCPlayer';

// Fix default Leaflet icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const LiveMapPage = () => {
  const { api, theme, user } = useApp();
  const isDark = theme === 'dark';
  const [locations, setLocations] = useState([]);
  const [servicePoints, setServicePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [visibleLayers, setVisibleLayers] = useState({
    team: true,
    cctv: true,
    skpd: true,
    ip_speaker: true
  });

  const toggleLayer = (layer) => {
    setVisibleLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const fetchData = async () => {
    try {
      const [locRes, spRes] = await Promise.all([
        axios.get('/api/attendance/live-locations', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }),
        api.getServicePoints({ include_status: true })
      ]);
      
      if (Array.isArray(locRes.data)) {
        setLocations(locRes.data);
      }
      if (spRes.data && Array.isArray(spRes.data.points)) {
        setServicePoints(spRes.data.points);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const createStaffIcon = (name) => {
    const iconMarkup = renderToStaticMarkup(
      <div className="relative flex flex-col items-center">
        <div className="absolute -top-1 w-3 h-3 bg-rose-500 rounded-full animate-ping"></div>
        <div className="w-10 h-10 bg-slate-900 border-2 border-rose-500 rounded-full flex items-center justify-center text-rose-500 shadow-lg z-10">
          <Navigation size={20} className="transform rotate-45" />
        </div>
        <span className="mt-1 bg-slate-900/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg border border-slate-700 whitespace-nowrap">
          {name}
        </span>
      </div>
    );
    return L.divIcon({ html: iconMarkup, className: 'custom-leaflet-icon', iconSize: [40, 60], iconAnchor: [20, 30], popupAnchor: [0, -30] });
  };

  const createServiceIcon = (type, name) => {
    let IconComp = Server;
    let colorClass = "text-emerald-400";
    let bgClass = "bg-emerald-400/20";
    let borderClass = "border-emerald-500/50";
    
    if (type === 'cctv') {
      IconComp = Camera;
      colorClass = "text-cyan-400";
      bgClass = "bg-cyan-400/20";
      borderClass = "border-cyan-500/50";
    } else if (type === 'ip_speaker') {
      IconComp = Megaphone;
      colorClass = "text-amber-400";
      bgClass = "bg-amber-400/20";
      borderClass = "border-amber-500/50";
    }

    const iconMarkup = renderToStaticMarkup(
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-lg backdrop-blur-sm flex items-center justify-center shadow-lg border ${bgClass} ${borderClass} ${colorClass}`}>
          <IconComp size={16} />
        </div>
      </div>
    );
    return L.divIcon({ html: iconMarkup, className: 'custom-leaflet-icon', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });
  };

  if (loading && locations.length === 0 && servicePoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const validServicePoints = servicePoints.map(sp => {
    if (sp.coordinates) {
      const [lat, lng] = sp.coordinates.split(',').map(s => parseFloat(s.trim()));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { ...sp, lat, lng };
      }
    }
    return null;
  }).filter(Boolean);

  return (
    <div className="h-[calc(100vh-8rem)] w-full relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl">
      <MapContainer 
        center={[-5.147665, 119.432731]} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          key={theme}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
          className={isDark ? "map-tiles-dark" : ""}
        />
        <ZoomControl position="topright" />
        
        {/* Render Staf */}
        {['admin', 'am'].includes(user?.role) && visibleLayers.team && locations.map((loc) => (
          <Marker key={loc.user_id} position={[loc.latitude, loc.longitude]} icon={createStaffIcon(loc.username)}>
            <Popup className="custom-popup">
              <div className="p-2 min-w-[150px]">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center">
                    <Users size={16} className="text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800 dark:text-white">{loc.full_name || loc.username}</p>
                    <p className="text-[10px] text-slate-500">{new Date(loc.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {loc.battery_level && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Baterai</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{loc.battery_level}%</span>
                    </div>
                  )}
                  {loc.speed !== undefined && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Kecepatan</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{Math.round(loc.speed * 3.6)} km/h</span>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render Titik Layanan */}
        {validServicePoints.filter(sp => {
           if (sp.service_type === 'cctv' && !visibleLayers.cctv) return false;
           if (sp.service_type === 'skpd' && !visibleLayers.skpd) return false;
           if (sp.service_type === 'ip_speaker' && !visibleLayers.ip_speaker) return false;
           return true;
        }).map((sp) => (
          <Marker key={sp.id} position={[sp.lat, sp.lng]} icon={createServiceIcon(sp.service_type, sp.name)}>
            <Popup className="custom-popup" maxWidth={320} minWidth={240}>
              <div className="w-full">
                {sp.service_type === 'cctv' && (
                  <div className="w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden">
                    {sp.status === 'online' ? (
                      <WebRTCPlayer streamId={sp.id} token={localStorage.getItem('token')} isGrid={false} />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
                        <Camera size={32} className="opacity-30" />
                        <span className="text-xs text-slate-500">Stream tidak tersedia</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <div className="relative w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      {sp.service_type === 'cctv' ? <Camera size={16} className="text-cyan-500" /> : sp.service_type === 'ip_speaker' ? <Megaphone size={16} className="text-amber-500" /> : <Server size={16} className="text-emerald-500" />}
                      {sp.status && sp.status !== 'unknown' && (
                        <span className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 ${isDark ? 'border-slate-800' : 'border-white'} rounded-full ${sp.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{sp.name}</p>
                      <p className="text-[10px] text-slate-500 capitalize">{sp.service_type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    {sp.status && sp.status !== 'unknown' && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Status</span>
                        <span className={`font-medium px-2 py-0.5 rounded-full text-[10px] ${sp.status === 'online' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {sp.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lokasi</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-right max-w-[140px] truncate">{sp.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bandwidth</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{sp.bandwidth} Mbps</span>
                    </div>
                    {sp.ip_address && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">IP</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">{sp.ip_address}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Floating Header Panel - Command Center */}
      <div className={`absolute top-4 left-4 z-[1000] p-4 rounded-xl shadow-2xl w-64 transition-all duration-300 ${isDark ? 'glass-panel' : 'glass-panel-light'}`}>
        <h2 className={`font-bold flex items-center gap-2 mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          <Activity className="w-5 h-5 text-cyan-500" /> Command Center
        </h2>
        
        <div className="space-y-1">
          {['admin', 'am'].includes(user?.role) && (
            <div 
              onClick={() => toggleLayer('team')}
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${visibleLayers.team ? (isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200') : (isDark ? 'hover:bg-slate-800/30 opacity-50' : 'hover:bg-slate-50 opacity-50')}`}
            >
              <div className="flex items-center gap-2">
                <Users size={16} className={visibleLayers.team ? "text-rose-500" : "text-slate-500"} />
                <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>W Team Aktif</span>
              </div>
              <span className={`text-xs font-bold ${visibleLayers.team ? (isDark ? 'text-white' : 'text-slate-800') : 'text-slate-500'}`}>
                {locations.length}
              </span>
            </div>
          )}

          <div 
            onClick={() => toggleLayer('skpd')}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${visibleLayers.skpd ? (isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200') : (isDark ? 'hover:bg-slate-800/30 opacity-50' : 'hover:bg-slate-50 opacity-50')}`}
          >
            <div className="flex items-center gap-2">
              <Server size={16} className={visibleLayers.skpd ? "text-emerald-500" : "text-slate-500"} />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Internet SKPD</span>
            </div>
            <span className={`text-xs font-bold ${visibleLayers.skpd ? (isDark ? 'text-white' : 'text-slate-800') : 'text-slate-500'}`}>
              {validServicePoints.filter(s => s.service_type === 'skpd').length}
            </span>
          </div>

          <div 
            onClick={() => toggleLayer('cctv')}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${visibleLayers.cctv ? (isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200') : (isDark ? 'hover:bg-slate-800/30 opacity-50' : 'hover:bg-slate-50 opacity-50')}`}
          >
            <div className="flex items-center gap-2">
              <Camera size={16} className={visibleLayers.cctv ? "text-cyan-500" : "text-slate-500"} />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>Jaringan CCTV</span>
            </div>
            <span className={`text-xs font-bold ${visibleLayers.cctv ? (isDark ? 'text-white' : 'text-slate-800') : 'text-slate-500'}`}>
              {validServicePoints.filter(s => s.service_type === 'cctv').length}
            </span>
          </div>

          <div 
            onClick={() => toggleLayer('ip_speaker')}
            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${visibleLayers.ip_speaker ? (isDark ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-slate-100 hover:bg-slate-200') : (isDark ? 'hover:bg-slate-800/30 opacity-50' : 'hover:bg-slate-50 opacity-50')}`}
          >
            <div className="flex items-center gap-2">
              <Megaphone size={16} className={visibleLayers.ip_speaker ? "text-amber-500" : "text-slate-500"} />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>IP Speaker</span>
            </div>
            <span className={`text-xs font-bold ${visibleLayers.ip_speaker ? (isDark ? 'text-white' : 'text-slate-800') : 'text-slate-500'}`}>
              {validServicePoints.filter(s => s.service_type === 'ip_speaker').length}
            </span>
          </div>

        </div>
      </div>

    </div>
  );
};

export default LiveMapPage;
