import React, { useState, useEffect } from 'react';
import { Video, List, MonitorOff, RefreshCw, Maximize, AlertCircle, Grid, Square, Search } from 'lucide-react';
import { useApp } from '../context/AppContext'; 

const API_BASE_URL = "https://zwmon.com/api"; 
const STREAM_BASE_URL = "https://zwmon.com/api/cctv/stream";

const LiveCCTVPage = () => {
  const { theme } = useApp(); 
  const isDark = theme === 'dark'; 
  
  const [cameras, setCameras] = useState([]);
  const [searchQuery, setSearchQuery] = useState(''); 
  
  const [activeCam, setActiveCam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [viewMode, setViewMode] = useState(1); 
  
  // State untuk me-refresh stream kalau putus
  const [streamKey, setStreamKey] = useState(Date.now());

  const [gridCameras, setGridCameras] = useState(Array(9).fill(null)); 
  const [activeGridSlot, setActiveGridSlot] = useState(0); 

  const token = localStorage.getItem('token');

  const fetchCameras = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/cctv/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      const camList = data.cctv_list || [];
      setCameras(camList);
      
      // PERBAIKAN 1: Gunakan 'prev' supaya tidak kena Stale State saat setInterval jalan
      setActiveCam(prevActive => {
        if (!prevActive && camList.length > 0) {
          return camList[0];
        }
        return prevActive; // Kalau sudah ada yang dipilih, biarkan saja (jangan di-reset)
      });

      setGridCameras(prev => {
        const newGrid = [...prev];
        let isEmpty = true;
        for (let i = 0; i < 9; i++) {
          if (newGrid[i] !== null) isEmpty = false;
        }
        if (isEmpty) {
          for (let i = 0; i < 9; i++) {
            newGrid[i] = camList[i] || null;
          }
        }
        return newGrid;
      });

      setLoading(false);
    } catch (error) {
      console.error("Gagal ambil list CCTV:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchCameras();
    // Refresh list status online/offline tiap 30 detik
    const interval = setInterval(fetchCameras, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSelectCamera = (cam) => {
    if (viewMode === 1) {
      setActiveCam(cam);
      setStreamError(false);
      setStreamLoading(true);
      setStreamKey(Date.now()); // Ubah key supaya image tag benar-benar me-reload RTSP
    } else if (viewMode === 9) {
      const newGrid = [...gridCameras];
      newGrid[activeGridSlot] = cam;
      setGridCameras(newGrid);
      setActiveGridSlot((prev) => (prev + 1) % 9);
    }
  };

  const toggleFullscreen = () => {
    const el = document.getElementById('cctv-workspace');
    if (el) {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }
  };

  const filteredCameras = cameras.filter(cam => 
    cam.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cam.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const bgMain = isDark ? 'bg-slate-950' : 'bg-gray-100';
  const bgCard = isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200';
  const textTitle = isDark ? 'text-slate-100' : 'text-gray-800';
  const textSub = isDark ? 'text-slate-400' : 'text-gray-500';
  const borderList = isDark ? 'border-slate-800' : 'border-gray-200';
  const hoverList = isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50';

  return (
    <div className={`min-h-screen ${bgMain} p-4 lg:p-6 transition-colors`}>
      <div className="container mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar */}
        <div className={`lg:col-span-1 ${bgCard} rounded-xl shadow-lg border p-4 h-[calc(100vh-100px)] flex flex-col`}>
          <div className={`flex items-center justify-between mb-3`}>
            <div className="flex items-center gap-2">
              <List className={textSub} />
              <h2 className={`font-bold ${textTitle}`}>Daftar Titik</h2>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded bg-rose-500/20 text-rose-500`}>
              {cameras.length} CCTV
            </span>
          </div>

          <div className={`relative mb-4 pb-4 border-b ${borderList}`}>
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Cari nama / lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2 text-sm rounded-lg outline-none border transition-colors ${
                isDark 
                  ? 'bg-slate-950 border-slate-700 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500' 
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
              }`}
            />
          </div>
          
          <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {loading ? (
              <div className={`text-center py-10 ${textSub} text-sm`}>Memuat data...</div>
            ) : filteredCameras.length === 0 ? (
              <div className={`text-center py-10 ${textSub} text-sm`}>CCTV tidak ditemukan.</div>
            ) : (
              filteredCameras.map((cam) => {
                const isActive = viewMode === 1 
                  ? activeCam?.id === cam.id 
                  : gridCameras[activeGridSlot]?.id === cam.id; 

                return (
                  <button
                    key={cam.id}
                    onClick={() => handleSelectCamera(cam)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${hoverList} text-left ${
                      isActive ? 'border-rose-500 bg-rose-500/10 ring-1 ring-rose-500' : borderList
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-10 h-10 rounded flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-gray-200'}`}>
                        <Video className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`} />
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-3 h-3 border-2 ${isDark ? 'border-slate-900' : 'border-white'} rounded-full ${
                        cam.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}></span>
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className={`text-sm font-bold truncate ${textTitle}`}>{cam.name}</p>
                      <p className={`text-[11px] truncate ${textSub}`}>{cam.location}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Main Display */}
        <div className="lg:col-span-3 space-y-4" id="cctv-workspace">
          <div className={`${bgCard} rounded-xl shadow-lg border p-4 h-full flex flex-col`}>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <div>
                <h2 className={`text-xl font-bold ${textTitle}`}>
                  {viewMode === 9 ? 'Pemantauan 9 Layar (Grid)' : (activeCam ? activeCam.name : 'Pilih Kamera')}
                </h2>
                <p className={`text-sm ${textSub}`}>
                  {viewMode === 9 ? 'Klik salah satu kotak, lalu pilih CCTV di samping untuk mengisi kotak tersebut.' : (activeCam ? activeCam.location : 'Pilih CCTV di samping')}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button 
                  onClick={() => setViewMode(1)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 1 ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Square className="w-4 h-4" /> 1 Layar
                </button>
                <button 
                  onClick={() => setViewMode(9)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 9 ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Grid className="w-4 h-4" /> 9 Layar
                </button>
                <div className="w-px h-5 bg-slate-700 mx-1"></div>
                <button 
                  onClick={toggleFullscreen}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
                  title="Fullscreen"
                >
                  <Maximize className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-black rounded-lg overflow-hidden relative border border-slate-800">
              
              {/* === MODE 1 LAYAR === */}
              {viewMode === 1 && (
                <div className="w-full h-full relative group aspect-video">
                  {!activeCam ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                      <MonitorOff className="w-16 h-16 mb-2 opacity-20" />
                      <p>Tidak ada stream aktif</p>
                    </div>
                  ) : streamError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 bg-slate-900">
                      <div className="animate-spin mb-3 w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full"></div>
                      <p>Koneksi Terputus, Mencoba menghubungkan kembali...</p>
                      <button onClick={() => { setStreamError(false); setStreamLoading(true); setStreamKey(Date.now()); }} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded hover:bg-rose-700 text-sm">
                        Muat Ulang Sekarang
                      </button>
                    </div>
                  ) : (
                    <>
                      {streamLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 text-white">
                          <div className="animate-spin mb-3 w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full"></div>
                          <span className="text-sm">Menghubungkan ke RTSP...</span>
                        </div>
                      )}
                      <img
                        key={streamKey}
                        src={`${STREAM_BASE_URL}/${activeCam.id}?token=${token}&t=${streamKey}`}
                        className="w-full h-full object-contain bg-black"
                        alt="CCTV Stream"
                        onLoad={() => setStreamLoading(false)}
                        onError={() => {
                          // PERBAIKAN 2: Auto reconnect kalau stream mati (timeout 5 detik)
                          setStreamLoading(false);
                          setStreamError(true);
                          setTimeout(() => {
                            setStreamError(false);
                            setStreamLoading(true);
                            setStreamKey(Date.now()); // Paksa refresh URL
                          }, 5000); 
                        }}
                      />
                      <button 
                        onClick={() => { setStreamLoading(true); setStreamError(false); setStreamKey(Date.now()); }} 
                        className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* === MODE 9 LAYAR === */}
              {viewMode === 9 && (
                <div className="w-full h-full grid grid-cols-2 lg:grid-cols-3 gap-1 p-1 bg-black aspect-video">
                  {gridCameras.map((cam, index) => {
                    const isActiveSlot = activeGridSlot === index;
                    
                    return (
                      <div 
                        key={`grid-${index}`} 
                        onClick={() => setActiveGridSlot(index)} 
                        className={`relative bg-slate-900 flex items-center justify-center cursor-pointer transition-all ${
                          isActiveSlot ? 'border-2 border-rose-500 z-10 ring-2 ring-rose-500/50' : 'border border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="absolute top-2 left-2 z-20 bg-black/70 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm max-w-[90%] truncate flex items-center gap-2">
                          <span>{cam ? `CH ${index + 1}: ${cam.name}` : `CH ${index + 1}: Kosong`}</span>
                        </div>

                        {isActiveSlot && (
                          <div className="absolute inset-0 border-4 border-rose-500 pointer-events-none z-30"></div>
                        )}
                        
                        {cam ? (
                          <>
                            <img
                              src={`${STREAM_BASE_URL}/${cam.id}?token=${token}&t=${streamKey + index}`}
                              className="w-full h-full object-cover"
                              alt={`Stream ${cam.name}`}
                              onError={(e) => {
                                // Auto Reconnect untuk 9 Layar
                                e.target.style.opacity = '0.3';
                                setTimeout(() => {
                                  if(e.target) {
                                    e.target.src = `${STREAM_BASE_URL}/${cam.id}?token=${token}&t=${Date.now()}`;
                                    e.target.style.opacity = '1';
                                  }
                                }, 6000); // Reconnect tiap 6 detik kalau putus
                              }}
                            />
                            <div className="absolute inset-0 hidden flex-col items-center justify-center text-rose-500 bg-slate-950">
                              <MonitorOff className="w-6 h-6 mb-1 opacity-50" />
                              <span className="text-[10px]">RTSP Error</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-700">
                            <MonitorOff className="w-8 h-8 mb-2" />
                            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400">Pilih Kamera di Samping</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {viewMode === 1 && (
              <div className={`mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t ${borderList}`}>
                <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">IP Address</p>
                  <p className={`font-mono text-sm font-bold ${textTitle}`}>{activeCam?.ip_address || '-'}</p>
                </div>
                <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">Brand</p>
                  <p className={`uppercase text-sm font-bold ${textTitle}`}>{activeCam?.cctv_brand || '-'}</p>
                </div>
                <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">Tipe Layanan</p>
                  <p className={`text-sm font-bold ${textTitle}`}>CCTV OUTDOOR</p>
                </div>
                <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                  <p className="text-xs text-slate-500 mb-1">Last Status</p>
                  <p className={`text-sm font-bold uppercase ${
                    activeCam?.status === 'online' ? 'text-emerald-500' : 'text-rose-500'
                  }`}>{activeCam?.status || '-'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default LiveCCTVPage;