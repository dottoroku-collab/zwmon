import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ShieldCheck, ShieldAlert, Clock, TrendingUp, AlertTriangle, Loader2, X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Cell, CartesianGrid
} from 'recharts';
import { formatDate, getSLAStatus, formatDuration } from '../utils/dateUtils';

const SLACompliancePage = () => {
  const { api } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // STATE UNTUK FILTER TAMPILAN (GRAFIK)
  const [months, setMonths] = useState('6');
  const [serviceType, setServiceType] = useState('all');

  // === STATE UNTUK MODAL DOWNLOAD PDF ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dlPeriodType, setDlPeriodType] = useState('bulanan');
  const [dlMonth, setDlMonth] = useState((new Date().getMonth() + 1).toString());
  const [dlQuarter, setDlQuarter] = useState('1');
  const [dlSemester, setDlSemester] = useState('1');
  const [dlYear, setDlYear] = useState(new Date().getFullYear().toString());
  
  // STATE BARU: Pilihan Layanan Khusus untuk Download
  const [dlServiceType, setDlServiceType] = useState('all');
  
  // STATE BARU: Tanggal Tanda Tangan
  const [signDate, setSignDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { months: parseInt(months) };
      if (serviceType !== 'all') params.service_type = serviceType;
      const res = await api.getSLACompliance(params);
      setData(res.data);
    } catch {
      toast.error('Gagal memuat data SLA');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDownload = async () => {
    try {
      setIsModalOpen(false);
      toast.info('Menyiapkan dokumen evaluasi...');
      const token = localStorage.getItem('token'); 
      
      const baseUrl = 'https://zwmon.com';
      
      const queryParams = new URLSearchParams({
          period_type: dlPeriodType,
          year: dlYear,
          service_type: dlServiceType, // KITA PAKAI STATE YANG DARI MODAL, BUKAN GRAFIK
          sign_date: signDate 
      });

      if (dlPeriodType === 'bulanan') queryParams.append('month', dlMonth);
      if (dlPeriodType === 'triwulan') queryParams.append('quarter', dlQuarter);
      if (dlPeriodType === 'semester') queryParams.append('semester', dlSemester);

      const urlTarget = `${baseUrl}/api/reports/evaluation-pdf?${queryParams.toString()}`;

      const response = await fetch(urlTarget, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Terjadi kesalahan di server backend!');
      }

      if (!response.ok) throw new Error('Gagal menarik data dari server backend');
      if (!contentType || !contentType.includes('application/pdf')) {
          throw new Error('File yang diterima bukan format PDF!');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // BIKIN NAMA FILE LEBIH UNIK SESUAI PILIHAN LAYANAN
      const serviceNameFile = dlServiceType === 'all' ? 'Semua_Layanan' : dlServiceType.toUpperCase();
      a.download = `Evaluasi_SLA_${dlPeriodType}_${serviceNameFile}_${dlYear}.pdf`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success('Laporan Evaluasi berhasil diunduh!');
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const compliance = data?.monthly_compliance || [];
  const breaches = data?.active_breaches || [];
  const avgUptime = compliance.length > 0
    ? (compliance.reduce((sum, c) => sum + c.uptime_percentage, 0) / compliance.length).toFixed(3)
    : 100;
  const totalBreached = compliance.filter(c => !c.sla_met).length;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="sla-compliance-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">SLA Compliance Tracking</h1>
          <p className="text-sm text-slate-400">Monitoring kepatuhan SLA dan historical data</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-slate-400 block mb-1">Periode Tampilan</label>
            <Select value={months} onValueChange={setMonths}>
              <SelectTrigger className="input-dark h-10"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="3">3 Bulan</SelectItem>
                <SelectItem value="6">6 Bulan</SelectItem>
                <SelectItem value="12">12 Bulan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-400 block mb-1">Layanan (Grafik)</label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="input-dark h-10"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Semua Layanan</SelectItem>
                <SelectItem value="cctv">CCTV</SelectItem>
                <SelectItem value="skpd">Internet SKPD</SelectItem>
                <SelectItem value="ip_speaker">IP Speaker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchData} className="btn-primary h-10">Terapkan</Button>
            <Button onClick={() => setIsModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-10">
              Download Evaluasi PDF
            </Button>
          </div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">Rata-rata Uptime</p>
              <p className={`text-2xl font-bold ${parseFloat(avgUptime) >= 99.5 ? 'text-emerald-400' : 'text-rose-400'}`}>{avgUptime}%</p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${parseFloat(avgUptime) >= 99.5 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
              {parseFloat(avgUptime) >= 99.5 ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldAlert className="w-5 h-5 text-rose-400" />}
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1">Target SLA</p>
          <p className="text-2xl font-bold text-cyan-400">{data?.sla_target || 99.5}%</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1">Bulan SLA Breach</p>
          <p className="text-2xl font-bold text-rose-400">{totalBreached}</p>
        </div>
        <div className="glass-card rounded-xl p-5">
          <p className="text-xs text-slate-400 mb-1">Tiket Melebihi Deadline</p>
          <p className="text-2xl font-bold text-amber-400">{breaches.length}</p>
        </div>
      </div>

      {/* UPTIME CHART */}
      {compliance.length > 0 && (
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tren Uptime Bulanan</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={compliance} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[99, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} formatter={(val) => [`${val.toFixed(4)}%`, 'Uptime']} />
              <ReferenceLine y={99.5} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "SLA 99.5%", fill: '#ef4444', fontSize: 11 }} />
              <Line type="monotone" dataKey="uptime_percentage" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} activeDot={{ r: 6, fill: '#06b6d4' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MODAL POPUP DOWNLOAD DENGAN TANGGAL TTD DAN PILIHAN LAYANAN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">Download Laporan Evaluasi</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              
              {/* DROPDOWN BARU: PILIHAN LAYANAN KHUSUS LAPORAN */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Pilih Layanan untuk Dilaporkan</label>
                <Select value={dlServiceType} onValueChange={setDlServiceType}>
                  <SelectTrigger className="input-dark w-full border-cyan-700/50 focus:ring-cyan-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">Semua Layanan (Gabungan)</SelectItem>
                    <SelectItem value="cctv">Hanya CCTV</SelectItem>
                    <SelectItem value="skpd">Hanya Internet SKPD</SelectItem>
                    <SelectItem value="ip_speaker">Hanya IP Speaker</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Jenis Periode</label>
                <Select value={dlPeriodType} onValueChange={setDlPeriodType}>
                  <SelectTrigger className="input-dark w-full"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="bulanan">Evaluasi Bulanan</SelectItem>
                    <SelectItem value="triwulan">Evaluasi Triwulan</SelectItem>
                    <SelectItem value="semester">Evaluasi Semester</SelectItem>
                    <SelectItem value="tahunan">Evaluasi Tahunan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {dlPeriodType === 'bulanan' && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Bulan</label>
                    <Select value={dlMonth} onValueChange={setDlMonth}>
                      <SelectTrigger className="input-dark w-full"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => (
                          <SelectItem key={i+1} value={(i+1).toString()}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {dlPeriodType === 'triwulan' && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Triwulan</label>
                    <Select value={dlQuarter} onValueChange={setDlQuarter}>
                      <SelectTrigger className="input-dark w-full"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="1">Triwulan I (Jan - Mar)</SelectItem>
                        <SelectItem value="2">Triwulan II (Apr - Jun)</SelectItem>
                        <SelectItem value="3">Triwulan III (Jul - Sep)</SelectItem>
                        <SelectItem value="4">Triwulan IV (Okt - Des)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {dlPeriodType === 'semester' && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Semester</label>
                    <Select value={dlSemester} onValueChange={setDlSemester}>
                      <SelectTrigger className="input-dark w-full"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="1">Semester I (Jan - Jun)</SelectItem>
                        <SelectItem value="2">Semester II (Jul - Des)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className={dlPeriodType === 'tahunan' ? 'col-span-2' : ''}>
                  <label className="text-xs text-slate-400 block mb-1">Tahun Laporan</label>
                  <Select value={dlYear} onValueChange={setDlYear}>
                    <SelectTrigger className="input-dark w-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* INPUT TANGGAL TTD */}
              <div className="pt-2 border-t border-slate-800">
                <label className="text-xs text-slate-400 block mb-1">Tanggal Tanda Tangan Laporan</label>
                <input 
                  type="date" 
                  value={signDate}
                  onChange={(e) => setSignDate(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>

            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-slate-800 bg-slate-900/50">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="hover:bg-slate-800 text-slate-300">
                Batal
              </Button>
              <Button onClick={handleConfirmDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SLACompliancePage;