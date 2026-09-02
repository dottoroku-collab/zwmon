import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapPin, Mic, MicOff } from 'lucide-react';
import { useApp } from '../context/AppContext';

const LiveMapPage = () => {
  const { api } = useApp();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // PTT State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const wsRef = useRef(null);

  const fetchLocations = async () => {
    try {
      const response = await axios.get('/api/attendance/live-locations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (Array.isArray(response.data)) {
        setLocations(response.data);
      } else {
        console.error("Expected array but got:", typeof response.data);
      }
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
    
    // Connect WebSocket for PTT
    const token = localStorage.getItem('token');
    const wsUrl = process.env.REACT_APP_API_URL 
      ? process.env.REACT_APP_API_URL.replace('http', 'ws') 
      : `ws://${window.location.host}/api`;
      
    wsRef.current = new WebSocket(`${wsUrl}/ws/${token}`);
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ptt_audio') {
          // Play the audio
          const audioUrl = process.env.REACT_APP_API_URL 
            ? `${process.env.REACT_APP_API_URL}${data.url}` 
            : data.url;
          
          const audio = new Audio(audioUrl);
          audio.play().catch(e => console.error("Auto-play failed:", e));
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Upload audio
        const formData = new FormData();
        formData.append('audio_file', audioBlob, `ptt_web_${Date.now()}.webm`);
        
        try {
          await api.post('/ptt/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (e) {
          console.error("Failed to upload PTT:", e);
          alert("Gagal mengirim pesan suara");
        }
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Mic access denied or error:", e);
      alert("Izin mikrofon diperlukan untuk Walkie-Talkie");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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
      
      <div className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm h-[70vh]">
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
                  {loc.speed !== undefined && <p className="text-xs text-slate-500">Speed: {Math.round(loc.speed * 3.6)} km/h</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* PTT Button Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center">
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${
              isRecording ? 'bg-red-500 scale-110 shadow-red-500/50' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isRecording ? <Mic size={32} /> : <MicOff size={32} />}
          </button>
          <span className="mt-2 text-xs font-bold bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded backdrop-blur-sm text-slate-800 dark:text-white">
            {isRecording ? 'Merekam... Lepas untuk kirim' : 'Tahan untuk Bicara (PTT)'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LiveMapPage;

