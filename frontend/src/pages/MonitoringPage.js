import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import {
  Wifi, WifiOff, RefreshCw, Clock, Server, Loader2,
  Activity, History, Settings2, Camera, Megaphone, Globe,
  Search, Download, FileDown
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import { formatDate, formatRelativeTime } from '../utils/dateUtils';

const SERVICE_CATEGORIES = [
  { key: 'skpd', label: 'Internet Dedicated SKPD', icon: Globe, color: 'cyan' },
  { key: 'cctv', label: 'Jaringan CCTV Terintegrasi', icon: Camera, color: 'rose' },
  { key: 'ip_speaker', label: 'Internet IP Speaker', icon: Megaphone, color: 'violet' },
];

const serviceNames = { cctv: 'CCTV', skpd: 'Internet SKPD', ip_speaker: 'IP Speaker' };

const MonitoringPage = () => {
  const { user, api, theme } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pinging, setPinging] = useState(false);
  
  // States for Filtering & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- OBAT ANTI CRASH: State untuk membatasi jumlah render (Pagination) ---
  const [visibleCount, setVisibleCount] = useState(20);
  
  // States for View History
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyHours, setHistoryHours] = useState('24');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  
  // States for Download History
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadParams, setDownloadParams] = useState({
    period: 'weekly',
    service: 'all'
  });

  const refreshRef = useRef(null);
  const isDark = theme !== 'light';

  useEffect(() => {
    fetchStatus();
    refreshRef.current = setInterval(fetchStatus, 60000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, []);

  // --- Reset porsi kembali ke 20 kalau filter/pencarian berubah ---
  useEffect(() => {
    setVisibleCount(20);
  }, [statusFilter, serviceFilter, searchTerm]);

  const fetchStatus = async () => {
    try {
      const res = await api.getMonitoringStatus();
      setData(res.data);
    } catch {
      toast.error('Gagal memuat status monitoring');
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    try {
      const res = await api.runPingCheck();
      toast.success(res.data.message);
      await fetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menjalankan ping');
    } finally {
      setPinging(false);
    }
  };

  const handleViewHistory = async (point) => {
    setSelectedPoint(point);
    setShowHistoryDialog(true);
    setHistoryLoading(true);
    try {
      const res = await api.getMonitoringHistory(point.id, parseInt(historyHours));
      setHistory(res.data.history || []);
    } catch {
      toast.error('Gagal memuat history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryFilter = async () => {
    if (!selectedPoint) return;
    setHistoryLoading(true);
    try {
      const res = await api.getMonitoringHistory(selectedPoint.id, parseInt(historyHours));
      setHistory(res.data.history || []);
    } catch {} finally { setHistoryLoading(false); }
  };

  const handleSetInterval = async (interval) => {
    try {
      await api.setPingInterval(parseInt(interval));
      toast.success(`Interval ping diubah ke ${interval} jam`);
      fetchStatus();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengubah interval');
    }
  };

  const handleDownloadMassal = async () => {
    setIsDownloading(true);
    try {
      const hours = downloadParams.period === 'weekly' ? 168 : 720;
      const pointsToFetch = downloadParams.service === 'all' 
        ? data.points 
        : data.points.filter(p => p.service_type === downloadParams.service);

      if (!pointsToFetch || pointsToFetch.length === 0) {
        toast.error('Tidak ada titik layanan untuk di-download');
        setIsDownloading(false);
        return;
      }

      toast.info(`Menyiapkan data untuk ${pointsToFetch.length} titik... Mohon tunggu.`);

      let allHistory = [];
      const chunkSize = 10;

      for (let i = 0; i < pointsToFetch.length; i += chunkSize) {
        const chunk = pointsToFetch.slice(i, i + chunkSize);
        const promises = chunk.map(point => 
          api.getMonitoringHistory(point.id, hours)
             .then(res => ({ point, history: res.data.history || [] }))
             .catch(() => ({ point, history: [] }))
        );
        
        const results = await Promise.all(promises);
        results.forEach(({ point, history }) => {
          history.forEach(h => {
            allHistory.push({
              'Nama Titik': point.name,
              'IP Address': point.ip_address,
              'Layanan': serviceNames[point.service_type] || point.service_type,
              'Status': h.status.toUpperCase(),
              'Response Time (ms)': h.response_time_ms || '',
              'Waktu Check': formatDate(h.timestamp)
            });
          });
        });
      }

      if (allHistory.length === 0) {
        toast.warning('Tidak ada data histori di periode ini.');
        setIsDownloading(false);
        return;
      }

      const headers = Object.keys(allHistory[0]);
      const csvContent = [
        headers.join(','), 
        ...allHistory.map(row => headers.map(h => `"${row[h]}"`).join(',')) 
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `History_Ping_${downloadParams.service}_${downloadParams.period}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Download berhasil, Boska!');
      setShowDownloadDialog(false);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mendownload history');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const allPoints = data?.points || [];
  const summary = data?.summary || {};

  // FILTER LOGIC
  let filteredPoints = allPoints;
  if (statusFilter !== 'all') filteredPoints = filteredPoints.filter(p => p.status === statusFilter);
  if (serviceFilter !== 'all') filteredPoints = filteredPoints.filter(p => p.service_type === serviceFilter);
  if (searchTerm) {
    const lowerSearch = searchTerm.toLowerCase();
    filteredPoints = filteredPoints.filter(p => 
      p.name.toLowerCase().includes(lowerSearch) || 
      (p.ip_address && p.ip_address.includes(lowerSearch))
    );
  }

  // --- OBAT ANTI CRASH: Potong array sesuai porsi yang boleh tampil ---
  const visiblePoints = filteredPoints.slice(0, visibleCount);

  return (
    <div className="space-y-6 animate-fade-in" data-testid="monitoring-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Pemantauan Titik Layanan</h1>
          <p className="text-sm text-slate-400">
            Interval ping: setiap {data?.ping_interval_hours || 3} jam | Auto-refresh: 1 menit
          </p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'admin' && (
            <Select value={String(data?.ping_interval_hours || 3)} onValueChange={handleSetInterval}>
              <SelectTrigger className={`w-[140px] h-10 ${isDark ? 'input-dark' : 'bg-white border-slate-200 text-slate-900'}`}>
                <Settings2 className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}>
                <SelectItem value="1">1 Jam</SelectItem>
                <SelectItem value="3">3 Jam</SelectItem>
                <SelectItem value="6">6 Jam</SelectItem>
                <SelectItem value="12">12 Jam</SelectItem>
                <SelectItem value="24">24 Jam</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button 
            onClick={() => setShowDownloadDialog(true)} 
            className={`h-10 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-200'}`}
          >
            <Download className="w-4 h-4 mr-2" />
            Download History
          </Button>
          <Button onClick={handlePing} disabled={pinging} className="btn-primary h-10 text-white">
            {pinging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Ping Sekarang
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard label="Total Titik" value={summary.total || 0} icon={Server} color="cyan" isDark={isDark} />
        <StatusCard label="Online" value={summary.online || 0} icon={Wifi} color="emerald" isDark={isDark} />
        <StatusCard label="Offline" value={summary.offline || 0} icon={WifiOff} color="rose" isDark={isDark} />
        <StatusCard label="Belum Dicheck" value={summary.unknown || 0} icon={Clock} color="amber" isDark={isDark} />
      </div>

      {/* Toolbar: Search & Filters */}
      <div className={`p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between ${isDark ? 'bg-slate-900/50 border border-white/5' : 'bg-white border border-slate-200'}`}>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Cari nama titik atau IP..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`pl-9 h-10 ${isDark ? 'input-dark' : ''}`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className={`w-[180px] h-10 ${isDark ? 'input-dark' : 'bg-white border-slate-200'}`}>
              <SelectValue placeholder="Pilih Layanan" />
            </SelectTrigger>
            <SelectContent className={isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}>
              <SelectItem value="all">Semua Layanan</SelectItem>
              <SelectItem value="cctv">CCTV</SelectItem>
              <SelectItem value="skpd">Internet SKPD</SelectItem>
              <SelectItem value="ip_speaker">IP Speaker</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700/50">
            {['all', 'online', 'offline', 'unknown'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  statusFilter === f 
                    ? 'bg-rose-500 text-white shadow-sm' 
                    : isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? 'Semua' : f === 'online' ? 'Online' : f === 'offline' ? 'Offline' : 'Unknown'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category Sections */}
      {SERVICE_CATEGORIES.map(cat => {
        if (serviceFilter !== 'all' && serviceFilter !== cat.key) return null;

        // Gunakan visiblePoints (yang sudah dipotong) untuk rendering box card-nya
        const catPoints = visiblePoints.filter(p => p.service_type === cat.key);
        // Tapi tetap hitung total dari allPoints supaya label angkanya tetap benar
        const catAll = allPoints.filter(p => p.service_type === cat.key);
        const online = catAll.filter(p => p.status === 'online').length;
        const offline = catAll.filter(p => p.status === 'offline').length;
        const total = catAll.length;
        const CatIcon = cat.icon;

        if (total === 0) return null;

        const catColors = {
          cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-500', border: 'border-cyan-500/30' },
          rose: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/30' },
          violet: { bg: 'bg-violet-500/10', text: 'text-violet-500', border: 'border-violet-500/30' },
        };
        const cc = catColors[cat.color];

        return (
          <div key={cat.key} className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-white border-slate-200'}`}>
              <div className={`w-10 h-10 rounded-lg ${cc.bg} flex items-center justify-center`}>
                <CatIcon className={`w-5 h-5 ${cc.text}`} />
              </div>
              <div className="flex-1">
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{cat.label}</h2>
                <div className="flex gap-4 text-xs mt-0.5">
                  <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>{total} titik keseluruhan</span>
                  <span className="text-emerald-500">{online} online</span>
                  <span className="text-rose-500">{offline} offline</span>
                </div>
              </div>
            </div>

            {catPoints.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catPoints.map(point => (
                  <PointCard key={point.id} point={point} onViewHistory={handleViewHistory} isDark={isDark} />
                ))}
              </div>
            ) : (
              <div className={`text-center py-6 text-sm rounded-lg ${isDark ? 'text-slate-500 bg-slate-900/30' : 'text-slate-400 bg-slate-50'}`}>
                {filteredPoints.length > 0 ? 'Scroll ke bawah dan klik tombol Tampilkan untuk melihat data ini.' : 'Tidak ada titik layanan yang sesuai filter di kategori ini.'}
              </div>
            )}
          </div>
        );
      })}

      {/* --- TOMBOL TAMPILKAN LEBIH BANYAK --- */}
      {visibleCount < filteredPoints.length && (
        <div className="flex justify-center mt-6 pb-6">
          <Button 
            onClick={() => setVisibleCount(v => v + 20)}
            className={`px-6 h-10 ${isDark ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-900 border border-slate-200'}`}
          >
            Tampilkan Lebih Banyak ({filteredPoints.length - visibleCount} tersisa)
          </Button>
        </div>
      )}

      {filteredPoints.length === 0 && (
        <div className={`text-center py-12 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          Tidak ada titik layanan yang cocok dengan pencarian dan filter Anda, Boska.
        </div>
      )}

      {/* ---------------- DIALOG DOWNLOAD HISTORY ---------------- */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent className={`max-w-md ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-rose-500" />
              Download History Ping
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Pilih Layanan</label>
              <Select 
                value={downloadParams.service} 
                onValueChange={(val) => setDownloadParams({...downloadParams, service: val})}
              >
                <SelectTrigger className={`h-11 ${isDark ? 'input-dark' : 'bg-white border-slate-200'}`}>
                  <SelectValue placeholder="Semua Layanan" />
                </SelectTrigger>
                <SelectContent className={isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}>
                  <SelectItem value="all">Semua Layanan Sekaligus</SelectItem>
                  <SelectItem value="cctv">Jaringan CCTV Saja</SelectItem>
                  <SelectItem value="skpd">Internet SKPD Saja</SelectItem>
                  <SelectItem value="ip_speaker">IP Speaker Saja</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Pilih Periode</label>
              <Select 
                value={downloadParams.period} 
                onValueChange={(val) => setDownloadParams({...downloadParams, period: val})}
              >
                <SelectTrigger className={`h-11 ${isDark ? 'input-dark' : 'bg-white border-slate-200'}`}>
                  <SelectValue placeholder="Mingguan" />
                </SelectTrigger>
                <SelectContent className={isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}>
                  <SelectItem value="weekly">Mingguan (7 Hari Terakhir)</SelectItem>
                  <SelectItem value="monthly">Bulanan (30 Hari Terakhir)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDownloadDialog(false)} disabled={isDownloading}>
              Batal
            </Button>
            <Button onClick={handleDownloadMassal} disabled={isDownloading} className="btn-primary">
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              {isDownloading ? 'Menyiapkan CSV...' : 'Download CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- DIALOG HISTORY INDIVIDU ---------------- */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className={`max-w-2xl max-h-[80vh] ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
          <DialogHeader>
            <DialogTitle>
              <span className={isDark ? 'text-white' : 'text-slate-900'}>History Ping - {selectedPoint?.name}</span>
              <span className={`text-sm block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{selectedPoint?.ip_address}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className={`text-xs block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Periode</label>
                <Select value={historyHours} onValueChange={setHistoryHours}>
                  <SelectTrigger className={`h-9 ${isDark ? 'input-dark' : 'bg-white border-slate-200 text-slate-900'}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}>
                    <SelectItem value="6">6 Jam</SelectItem>
                    <SelectItem value="24">24 Jam</SelectItem>
                    <SelectItem value="72">3 Hari</SelectItem>
                    <SelectItem value="168">7 Hari</SelectItem>
                    <SelectItem value="720">30 Hari</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleHistoryFilter} size="sm" className="btn-primary h-9 text-white">
                Tampilkan
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-1 pr-2">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
              ) : history.length > 0 ? (
                history.map((h, i) => (
                  <div key={h.id || i} className={`flex items-center justify-between px-3 py-2 rounded text-sm ${isDark ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${h.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                      <span className={h.status === 'online' ? 'text-emerald-500' : 'text-rose-500'}>{h.status.toUpperCase()}</span>
                    </div>
                    <div className={`flex items-center gap-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {h.response_time_ms != null && <span>{h.response_time_ms} ms</span>}
                      <span className="text-xs">{formatDate(h.timestamp)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className={`text-center py-8 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Belum ada data ping</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PointCard = ({ point, onViewHistory, isDark }) => {
  const statusConfig = {
    online: { bg: 'border-emerald-500/40', dot: 'bg-emerald-400', text: 'text-emerald-500', label: 'ONLINE' },
    offline: { bg: 'border-rose-500/40', dot: 'bg-rose-400', text: 'text-rose-500', label: 'OFFLINE' },
    unknown: { bg: isDark ? 'border-slate-700' : 'border-slate-300', dot: 'bg-slate-400', text: 'text-slate-400', label: 'UNKNOWN' }
  };
  const cfg = statusConfig[point.status] || statusConfig.unknown;

  return (
    <div className={`glass-card rounded-xl p-5 border-l-4 ${cfg.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{point.name}</h3>
          <p className="text-xs text-slate-500">{point.location}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Kalau error lagi, bagian animate-pulse ini bisa kita cabut, tapi harusnya sudah aman mi dengan sistem Porsi */}
          <div className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`}></div>
          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div><span className="text-slate-500">IP:</span> <span className={`mono ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{point.ip_address}</span></div>
        <div><span className="text-slate-500">Layanan:</span> <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{serviceNames[point.service_type] || '-'}</span></div>
        <div><span className="text-slate-500">BW:</span> <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{point.bandwidth} Mbps</span></div>
        <div><span className="text-slate-500">Response:</span> <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>{point.response_time_ms != null ? `${point.response_time_ms} ms` : '-'}</span></div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {point.last_check ? formatRelativeTime(point.last_check) : 'Belum dicheck'}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onViewHistory(point)} className="text-cyan-500 hover:text-cyan-400 h-7 text-xs">
          <History className="w-3 h-3 mr-1" />History
        </Button>
      </div>
    </div>
  );
};

const StatusCard = ({ label, value, icon: Icon, color, isDark }) => {
  const colors = { emerald: 'bg-emerald-500/20 text-emerald-400', rose: 'bg-rose-500/20 text-rose-400', cyan: 'bg-cyan-500/20 text-cyan-400', amber: 'bg-amber-500/20 text-amber-400' };
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">{label}</p>
          <p className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default MonitoringPage;