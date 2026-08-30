import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  DollarSign, Calendar, Filter, Download, TrendingDown, 
  CheckCircle, AlertTriangle, Loader2, FileText
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const serviceNames = { cctv: 'CCTV', skpd: 'Internet SKPD', ip_speaker: 'IP Speaker' };

const RestitutionReportPage = () => {
  const { api } = useApp();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [downloading, setDownloading] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [serviceType, setServiceType] = useState('all');

  useEffect(() => {
    fetchReport();
    fetchDaily();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = { month: parseInt(month), year: parseInt(year) };
      if (serviceType !== 'all') params.service_type = serviceType;
      const res = await api.getRestitutionReport(params);
      setReport(res.data);
    } catch (error) {
      toast.error('Gagal memuat laporan restitusi');
    } finally {
      setLoading(false);
    }
  };

  const fetchDaily = async () => {
    try {
      const res = await api.getDailyRestitution(30);
      setDailyData(res.data.daily_restitution || []);
    } catch { }
  };

  const handleFilter = () => {
    fetchReport();
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const params = { month: parseInt(month), year: parseInt(year) };
      if (serviceType !== 'all') params.service_type = serviceType;
      const res = await api.downloadMonthlyPDF(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_${monthNames[parseInt(month)]}_${year}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF berhasil didownload');
    } catch (error) {
      toast.error('Gagal mendownload PDF');
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (val) => {
    if (val === 0) return 'Rp 0';
    return `Rp ${val.toLocaleString('id-ID')}`;
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="restitution-report-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Laporan Restitusi</h1>
          <p className="text-sm text-slate-400">Kalkulasi restitusi otomatis dari tiket Gangguan Jaringan Telkom yang selesai</p>
        </div>
        <Button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="btn-primary"
          data-testid="download-pdf-btn"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
          Download PDF
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-slate-400 block mb-1">Bulan</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="input-dark h-10" data-testid="month-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {monthNames.slice(1).map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[100px]">
            <label className="text-xs text-slate-400 block mb-1">Tahun</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="input-dark h-10" data-testid="year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-400 block mb-1">Layanan</label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="input-dark h-10" data-testid="service-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Semua Layanan</SelectItem>
                <SelectItem value="cctv">CCTV</SelectItem>
                <SelectItem value="skpd">Internet SKPD</SelectItem>
                <SelectItem value="ip_speaker">IP Speaker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleFilter} className="btn-primary h-10" data-testid="filter-btn">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={FileText}
            label="Total Tiket (Gangguan Jaringan Telkom)"
            value={report.summary.total_tickets}
            color="cyan"
          />
          <SummaryCard
            icon={TrendingDown}
            label="Total Downtime"
            value={`${report.summary.total_downtime_minutes} menit`}
            color="amber"
          />
          <SummaryCard
            icon={DollarSign}
            label="Total Restitusi"
            value={formatCurrency(report.summary.total_restitution)}
            color="rose"
          />
          <SummaryCard
            icon={AlertTriangle}
            label="SLA Dilanggar"
            value={report.summary.sla_breached_count}
            color="rose"
          />
        </div>
      )}

      {/* Daily Chart */}
      {dailyData.length > 0 && (
        <div className="glass-card rounded-xl p-6" data-testid="daily-chart">
          <h3 className="text-lg font-semibold text-white mb-4">Restitusi Harian (30 Hari Terakhir)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData.slice(0, 30).reverse()}>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v.slice(8)} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v > 0 ? `${(v/1000000).toFixed(1)}jt` : '0'} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                formatter={(val) => [formatCurrency(val), 'Restitusi']}
              />
              <Bar dataKey="estimated_restitution" radius={[4, 4, 0, 0]}>
                {dailyData.slice(0, 30).reverse().map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? '#ef4444' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail Table */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : report && report.items.length > 0 ? (
        <div className="glass-card rounded-xl overflow-hidden" data-testid="restitution-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/50">
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">No</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Titik Layanan</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Layanan</th>
                  {/* KOLOM BARU UNTUK BANDWIDTH & TIPE */}
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Bandwidth (Tipe)</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Tanggal Close</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400 font-medium">Downtime</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400 font-medium">SLA %</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-400 font-medium">Restitusi</th>
                </tr>
              </thead>
              <tbody>
                {report.items.map((item, idx) => (
                  <tr key={item.ticket_id} className="border-t border-slate-800/50 hover:bg-slate-800/20" data-testid={`restitution-row-${idx}`}>
                    <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-white text-sm">{item.service_point_name}</p>
                      <p className="text-xs text-slate-500">{item.location}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-300">{serviceNames[item.service_type] || item.service_type}</p>
                      <p className="text-slate-500 mono text-xs mt-0.5">{item.ip_address}</p>
                    </td>
                    {/* ISI KOLOM BARU BANDWIDTH */}
                    <td className="px-4 py-3">
                      <p className="text-white">{item.bandwidth} Mbps</p>
                      <p className={`text-xs ${item.service_type === 'skpd' ? 'text-rose-400' : 'text-amber-400'}`}>
                        {item.service_type === 'skpd' ? '(Bulky)' : '(Satuan)'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{item.closed_at ? new Date(item.closed_at).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-amber-400">{item.downtime_minutes} min</span>
                      <span className="text-slate-500 text-xs block">({item.downtime_days} hari)</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={item.sla_met ? 'text-emerald-400' : 'text-rose-400'}>
                        {item.uptime_percentage.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-rose-400">
                      {formatCurrency(item.restitution_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 bg-slate-800/30">
                  {/* SESUAIKAN COLSPAN JADI 5 KARENA ADA TAMBAHAN KOLOM */}
                  <td colSpan={5} className="px-4 py-3 text-right text-white font-semibold">TOTAL</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-semibold">{report.summary.total_downtime_minutes} min</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-rose-400 font-bold text-base">
                    {formatCurrency(report.summary.total_restitution)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : report ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-white text-lg font-medium">Tidak Ada Restitusi</p>
          <p className="text-slate-400 text-sm">Tidak ada tiket Gangguan Jaringan Telkom yang selesai pada periode ini</p>
        </div>
      ) : null}
    </div>
  );
};

const SummaryCard = ({ icon: Icon, label, value, color }) => {
  const colors = { rose: 'bg-rose-500/20 text-rose-400', cyan: 'bg-cyan-500/20 text-cyan-400', amber: 'bg-amber-500/20 text-amber-400' };
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
};

export default RestitutionReportPage;