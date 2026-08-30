import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  FileText, 
  Download, 
  Filter,
  Ticket,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const statusLabels = {
  open: 'Terbuka',
  assigned: 'Ditugaskan',
  in_progress: 'Sedang Dikerjakan',
  pending_review: 'Menunggu Review',
  pending_verification: 'Menunggu Verifikasi',
  escalated: 'Dieskalasi',
  closed: 'Selesai'
};

const serviceNames = {
  cctv: 'CCTV',
  skpd: 'Internet SKPD',
  ip_speaker: 'IP Speaker'
};

const ReportsPage = () => {
  const { api } = useApp();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    service_type: 'all',
    status: 'all'
  });

  const handleFilterChange = (name, value) => {
    setFilters({ ...filters, [name]: value });
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.service_type !== 'all') params.service_type = filters.service_type;
      if (filters.status !== 'all') params.status = filters.status;

      const response = await api.getTicketReport(params);
      setReportData(response.data);
    } catch (error) {
      toast.error('Gagal mengambil data laporan');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData?.tickets?.length) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const headers = [
      'ID Tiket', 'Judul', 'Layanan', 'Skenario', 'Status', 
      'Prioritas', 'Pelapor', 'Lokasi', 'Tanggal Mulai', 
      'Tanggal Selesai', 'Waktu Penanganan (Menit)'
    ];
    
    const rows = reportData.tickets.map(t => [
      t.id,
      t.title,
      serviceNames[t.service_type] || t.service_type,
      t.scenario ? `Skenario ${t.scenario}` : 'Belum Diklasifikasi',
      statusLabels[t.status] || t.status,
      t.priority,
      t.client_name,
      t.location,
      new Date(t.created_at).toLocaleString('id-ID'),
      t.closed_at ? new Date(t.closed_at).toLocaleString('id-ID') : '-',
      t.total_downtime_minutes || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_SLA_Gangguan_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success('Laporan CSV berhasil diunduh');
  };

  const downloadPDFReport = async () => {
    try {
      toast.info("Sedang menyusun dokumen PDF resmi, mohon tunggu...");
      const token = localStorage.getItem('token');
      
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.service_type !== 'all') params.append('service_type', filters.service_type);
      if (filters.status !== 'all') params.append('status', filters.status);

      // Kita pakai path relatif supaya otomatis menyesuaikan host zwmon.com
      const response = await fetch(`/api/reports/tickets-pdf?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Gagal mendownload PDF dari server');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan_Resmi_Tiket_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('Laporan PDF resmi berhasil diunduh!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal men-download PDF laporan resmi');
    }
  };

  // Kalkulasi Rasio Skenario
  const scenarioA = reportData?.statistics?.by_scenario?.A || 0;
  const scenarioB = reportData?.statistics?.by_scenario?.B || 0;
  const totalScenario = scenarioA + scenarioB;
  const percentA = totalScenario ? Math.round((scenarioA / totalScenario) * 100) : 0;
  const percentB = totalScenario ? Math.round((scenarioB / totalScenario) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in print:bg-white print:text-black">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase">Laporan Rekapitulasi Tiket</h1>
          <p className="text-slate-400">Monitoring Skenario A & B serta durasi penanganan</p>
        </div>
        
        {reportData && (
          <div className="flex gap-2 print:hidden">
            <Button onClick={exportToCSV} variant="outline" className="border-slate-700">
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button onClick={downloadPDFReport} className="bg-rose-600 text-white hover:bg-rose-700">
              <FileText className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="glass-card rounded-xl p-6 space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Dari Tanggal</Label>
            <Input type="date" value={filters.start_date} onChange={(e) => handleFilterChange('start_date', e.target.value)} className="input-dark text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Sampai Tanggal</Label>
            <Input type="date" value={filters.end_date} onChange={(e) => handleFilterChange('end_date', e.target.value)} className="input-dark text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Layanan</Label>
            <Select value={filters.service_type} onValueChange={(v) => handleFilterChange('service_type', v)}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Semua Layanan</SelectItem>
                <SelectItem value="cctv">CCTV</SelectItem>
                <SelectItem value="skpd">Internet SKPD</SelectItem>
                <SelectItem value="ip_speaker">IP Speaker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">Status</Label>
            <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger className="input-dark"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="closed">Selesai (Closed)</SelectItem>
                <SelectItem value="open">Masih Terbuka</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={generateReport} disabled={loading} className="btn-primary w-full md:w-auto">
          {loading ? 'Memuat...' : 'Generate Laporan'}
        </Button>
      </div>

      {reportData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-4">
              <StatCard icon={Ticket} label="Total Tiket" value={reportData.statistics?.total || 0} color="cyan" />
              <StatCard icon={CheckCircle} label="Selesai" value={reportData.statistics?.by_status?.closed || 0} color="emerald" />
              <StatCard icon={Clock} label="Avg Down (A)" value={`${reportData.statistics?.avg_downtime_scenario_a_minutes || 0}m`} color="amber" />
              <StatCard icon={AlertTriangle} label="Rasio B" value={`${percentB}%`} color="rose" />
            </div>

            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Rasio Skenario A vs B</h3>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-rose-400">Skenario A: {scenarioA}</span>
                <span className="text-amber-400">Skenario B: {scenarioB}</span>
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div style={{ width: `${percentA}%` }} className="bg-rose-500"></div>
                <div style={{ width: `${percentB}%` }} className="bg-amber-500"></div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-900/50 text-xs uppercase text-slate-400">
                  <th className="px-4 py-3">ID Tiket</th>
                  <th className="px-4 py-3">Layanan</th>
                  <th className="px-4 py-3 text-center">Skenario</th>
                  <th className="px-4 py-3">Waktu Penanganan</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {reportData.tickets?.map((t) => (
                  <tr key={t.id} className="hover:bg-white/5 text-sm">
                    <td className="px-4 py-3">
                      <div className="text-white font-mono">{t.id}</div>
                      <div className="text-xs text-slate-500">{t.title}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{serviceNames[t.service_type]}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.scenario === 'A' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'}`}>
                        {t.scenario || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {t.total_downtime_minutes ? `${t.total_downtime_minutes} Menit` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`status-${t.status} px-2 py-1 rounded text-[10px]`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    cyan: 'bg-cyan-500/20 text-cyan-400',
    amber: 'bg-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    rose: 'bg-rose-500/20 text-rose-400'
  };
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${colors[color]} flex items-center justify-center`}><Icon size={16} /></div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">{label}</p>
          <p className="text-lg font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;