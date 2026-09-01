import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  Ticket, Users, Clock, CheckCircle, AlertCircle, TrendingUp,
  Camera, Server, Megaphone, ArrowRight, Plus, BarChart3, Globe, Activity,
  Calendar, Trophy, AlertTriangle, MapPin, Zap
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const statusLabels = {
  open: 'Terbuka', assigned: 'Ditugaskan', in_progress: 'Sedang Dikerjakan',
  pending_review: 'Menunggu Review', pending_verification: 'Menunggu Verifikasi AM',
  escalated: 'Dieskalasi', closed: 'Selesai'
};

const serviceIcons = { cctv: Camera, skpd: Server, ip_speaker: Megaphone };
const serviceNames = { cctv: 'CCTV', skpd: 'Internet SKPD', ip_speaker: 'IP Speaker' };

const COLORS = {
  status: ['#3b82f6', '#f59e0b', '#06b6d4', '#a855f7', '#f97316', '#ef4444', '#10b981'],
  service: ['#06b6d4', '#f43f5e', '#8b5cf6'],
  scenario: ['#ef4444', '#10b981', '#64748b'],
  priority: ['#10b981', '#f59e0b', '#ef4444', '#dc2626'],
  sla: ['#10b981', '#ef4444']
};

const DashboardPage = () => {
  const { user, api } = useApp();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  // --- FUNGSI JALAN PINTAS AMAN UNTUK ONLINE USER ---
  const fetchOnlineUsersSafely = async () => {
    try {
      const token = localStorage.getItem('token');
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      const res = await fetch(`${backendUrl}/api/admin/who-is-online`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOnlineUsers(data.users);
      }
    } catch (err) {
      console.warn("Gagal memuat data online users, tapi dashboard tetap aman");
    }
  };

  const fetchDashboardData = async (month, year) => {
    setLoading(true);
    try {
      const queryParams = { month: parseInt(month), year: parseInt(year) };
      const hasAccess = ['admin', 'am', 'helpdesk'].includes(user?.role);
      
      const [statsRes, chartRes, analyticsRes] = await Promise.allSettled([
        api.getDashboardStats(queryParams),
        hasAccess ? api.getDashboardChartData(queryParams) : Promise.resolve(null),
        hasAccess ? api.getDashboardAnalytics() : Promise.resolve(null)
      ]);
      
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (chartRes.status === 'fulfilled' && chartRes.value?.data) setChartData(chartRes.value.data);
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.data) setAnalytics(analyticsRes.value.data);
      
      // Khusus Admin & AM, panggil user online secara terpisah supaya tidak bikin crash
      if (['admin', 'am'].includes(user?.role)) {
        fetchOnlineUsersSafely();
      }

    } catch (error) {
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedMonth, selectedYear);
    
    // Polling setiap 30 detik khusus untuk data online user (agar real-time)
    let interval;
    if (['admin', 'am'].includes(user?.role)) { 
      interval = setInterval(() => {
        fetchOnlineUsersSafely();
      }, 30000);
    }
    
    return () => { if (interval) clearInterval(interval); };
  }, [selectedMonth, selectedYear, user?.role]);

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear - 1, currentYear - 2];
  };

  const months = [
    { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
    { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' }, { value: '12', label: 'Desember' }
  ];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative" data-testid="dashboard-page">
      {loading && stats && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm rounded-xl">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
         </div>
      )}

      {/* Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mb-2">
            Selamat Datang, {user?.full_name || user?.username}!
          </h1>
          <p className="text-slate-400">Ringkasan aktivitas sistem tiketing untuk periode yang dipilih.</p>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
          <Calendar className="w-5 h-5 text-slate-400 ml-2" />
          
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] h-9 input-dark border-transparent bg-transparent focus:ring-0">
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-slate-700"></div>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px] h-9 input-dark border-transparent bg-transparent focus:ring-0">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              {generateYearOptions().map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PingSummarySection stats={stats} />
      
      {['admin', 'am', 'helpdesk'].includes(user?.role) && <AnalyticsSection analytics={analytics} />}

      {/* --- Tampilkan Online Users untuk Admin DAN AM --- */}
      {['admin', 'am'].includes(user?.role) && <OnlineUsersSection users={onlineUsers} />}

      {user?.role === 'admin' && <AdminDashboard stats={stats} chartData={chartData} />}
      {user?.role === 'am' && <AMDashboard stats={stats} chartData={chartData} />}
      {user?.role === 'helpdesk' && <HelpdeskDashboard stats={stats} chartData={chartData} />}
      {user?.role === 'eos' && <EOSDashboard stats={stats} />}
      {user?.role === 'client' && <ClientDashboard stats={stats} />}
    </div>
  );
};

// ========== Komponen Online Users Monitor ==========
const OnlineUsersSection = ({ users }) => {
  if (!users) return null;

  return (
    <div className="glass-card rounded-xl p-6 border border-emerald-500/20 mt-8 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-emerald-400 animate-pulse" />
          Monitor Pengguna Online (Real-time)
        </h3>
        <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
          {users.length} User Aktif
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {users.map((u, i) => (
          <div key={i} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50 flex items-center gap-4 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 shadow-[0_0_8px_#10b981]"></div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white truncate">{u.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-tighter">
                  {u.role}
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> {u.sessions} Tab Aktif
                </span>
              </div>
            </div>

            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="col-span-full py-6 text-center bg-slate-800/20 rounded-lg border border-dashed border-slate-700 text-slate-500 italic">
            Belum ada user yang online.
          </div>
        )}
      </div>
    </div>
  );
};

// ========== Ping Summary Section ==========
const PingSummarySection = ({ stats }) => {
  if (!stats?.ping_details) return null;

  const services = [
    { key: 'cctv', label: 'CCTV Monitoring', icon: Camera, color: 'rose' },
    { key: 'skpd', label: 'Internet SKPD', icon: Server, color: 'cyan' },
    { key: 'ip_speaker', label: 'IP Speaker', icon: Megaphone, color: 'violet' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {services.map((svc) => {
        const data = stats.ping_details[svc.key] || { online: 0, offline: 0 };
        const Icon = svc.icon;
        const total = data.online + data.offline;
        const uptimePercent = total > 0 ? (data.online / total) * 100 : 0;
        
        return (
          <div key={svc.key} className="glass-card rounded-2xl overflow-hidden border border-slate-700/50 hover:border-slate-500 transition-all">
            <div className="p-3 bg-slate-800/80 flex items-center gap-2 border-b border-slate-700/50">
              <Icon className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{svc.label}</span>
            </div>
            
            <div className="p-5 flex justify-between items-center bg-gradient-to-br from-transparent to-slate-900/30">
              <div className="text-left">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Online</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-emerald-400">{data.online}</span>
                  <span className="text-xs text-slate-600 font-bold">/{total}</span>
                </div>
              </div>
              
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Offline</p>
                <span className={`text-3xl font-black ${data.offline > 0 ? 'text-rose-500 animate-pulse' : 'text-slate-700'}`}>
                  {data.offline}
                </span>
              </div>
            </div>

            <div className="px-5 pb-4">
              <div className="flex justify-between text-[9px] font-bold mb-1 uppercase">
                <span className="text-slate-500">Service Health</span>
                <span className={uptimePercent === 100 ? 'text-emerald-500' : 'text-amber-500'}>
                  {uptimePercent.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_8px_#10b981]" 
                  style={{ width: `${uptimePercent}%` }}
                />
                <div 
                  className="h-full bg-rose-500 transition-all duration-1000" 
                  style={{ width: `${100 - uptimePercent}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ========== Admin Dashboard ==========
const AdminDashboard = ({ stats, chartData }) => (
  <div className="space-y-8 mt-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard icon={Users} label="Total Pengguna" value={stats?.total_users || 0} color="cyan" />
      <StatCard icon={Ticket} label="Total Tiket" value={stats?.total_tickets || 0} color="rose" />
      <StatCard icon={AlertCircle} label="Tiket Terbuka" value={stats?.open_tickets || 0} color="amber" />
      <StatCard icon={CheckCircle} label="Tiket Selesai" value={stats?.closed_tickets || 0} color="emerald" />
    </div>

    {chartData && <DashboardCharts chartData={chartData} />}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-2 gap-4">
          <Link to="/users" data-testid="quick-users-link">
            <Button variant="outline" className="w-full h-20 flex-col gap-2 border-slate-700 hover:bg-slate-800">
              <Users className="w-6 h-6 text-cyan-400" />
              <span className="text-sm">Kelola User</span>
            </Button>
          </Link>
          <Link to="/settings" data-testid="quick-settings-link">
            <Button variant="outline" className="w-full h-20 flex-col gap-2 border-slate-700 hover:bg-slate-800">
              <TrendingUp className="w-6 h-6 text-rose-400" />
              <span className="text-sm">Pengaturan</span>
            </Button>
          </Link>
        </div>
      </div>
      <RecentTickets tickets={stats?.recent_tickets} />
    </div>
  </div>
);

// ========== AM Dashboard ==========
const AMDashboard = ({ stats, chartData }) => (
  <div className="space-y-8 mt-8">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <StatCard icon={Clock} label="Menunggu Verifikasi" value={stats?.pending_verification || 0} color="amber" />
      <StatCard icon={CheckCircle} label="Diverifikasi Di Periode Ini" value={stats?.verified_today || 0} color="emerald" />
      <StatCard icon={Ticket} label="Total Selesai" value={stats?.total_closed || 0} color="cyan" />
      <StatCard icon={TrendingUp} label="Est. Restitusi Bulan Ini" value={`Rp ${(stats?.daily_restitution || 0).toLocaleString('id-ID')}`} color="rose" />
    </div>

    {chartData && <DashboardCharts chartData={chartData} />}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass-card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Aksi Cepat</h3>
        <div className="grid grid-cols-2 gap-4">
          <Link to="/restitution" data-testid="quick-restitution-link">
            <Button variant="outline" className="w-full h-16 flex-col gap-1 border-slate-700 hover:bg-slate-800">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span className="text-xs">Kalkulator</span>
            </Button>
          </Link>
          <Link to="/restitution-report" data-testid="quick-restitution-report-link">
            <Button variant="outline" className="w-full h-16 flex-col gap-1 border-slate-700 hover:bg-slate-800">
              <TrendingUp className="w-5 h-5 text-rose-400" />
              <span className="text-xs">Laporan Restitusi</span>
            </Button>
          </Link>
        </div>
      </div>
      <RecentTickets tickets={stats?.recent_tickets} />
    </div>
  </div>
);

// ========== Helpdesk Dashboard ==========
const HelpdeskDashboard = ({ stats, chartData }) => (
  <div className="space-y-8 mt-8">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard icon={AlertCircle} label="Tiket Terbuka" value={stats?.open_tickets || 0} color="rose" />
      <StatCard icon={Clock} label="Sudah Ditugaskan" value={stats?.assigned_tickets || 0} color="amber" />
      <StatCard icon={CheckCircle} label="Menunggu Review" value={stats?.pending_review || 0} color="cyan" />
    </div>

    {chartData && <DashboardCharts chartData={chartData} />}

    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Tiket Perlu Ditugaskan</h3>
        <Link to="/tickets" data-testid="view-all-tickets-link">
          <Button variant="ghost" className="text-rose-400 hover:text-rose-300">
            Lihat Semua <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>
      <RecentTickets tickets={stats?.recent_tickets?.filter(t => t.status === 'open')} inline />
    </div>
  </div>
);

// ========== EOS Dashboard ==========
const EOSDashboard = ({ stats }) => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <StatCard icon={Ticket} label="Tiket Ditugaskan" value={stats?.assigned_to_me || 0} color="amber" />
      <StatCard icon={CheckCircle} label="Selesai Di Periode Ini" value={stats?.completed_today || 0} color="emerald" />
    </div>
    <RecentTickets tickets={stats?.recent_tickets} showLogbook />
  </div>
);

// ========== Client Dashboard ==========
const ClientDashboard = ({ stats }) => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard icon={Ticket} label="Total Tiket Saya" value={stats?.my_tickets || 0} color="cyan" />
      <StatCard icon={Clock} label="Sedang Diproses" value={stats?.open_tickets || 0} color="amber" />
      <StatCard icon={AlertCircle} label="Perlu Review" value={stats?.pending_review || 0} color="rose" />
    </div>
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Tiket Terbaru</h3>
        <Link to="/tickets/create" data-testid="create-ticket-btn">
          <Button className="btn-primary"><Plus className="w-4 h-4 mr-2" />Buat Tiket</Button>
        </Link>
      </div>
      <RecentTickets tickets={stats?.recent_tickets} inline />
    </div>
  </div>
);

// ========== Chart Section ==========
const DashboardCharts = ({ chartData }) => {
  const hasData = chartData?.total_tickets > 0;
  if (!hasData) {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Belum ada data grafik tiket untuk bulan ini</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="dashboard-charts">
      <ChartCard title="Tiket per Status">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chartData.by_status} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
              {chartData.by_status.map((_, i) => (
                <Cell key={i} fill={COLORS.status[i % COLORS.status.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tiket per Layanan">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData.by_service} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
            <Bar dataKey="value" name="Jumlah" radius={[6, 6, 0, 0]}>
              {chartData.by_service.map((_, i) => (
                <Cell key={i} fill={COLORS.service[i % COLORS.service.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distribusi Skenario">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chartData.by_scenario.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
              {chartData.by_scenario.map((_, i) => (
                <Cell key={i} fill={COLORS.scenario[i % COLORS.scenario.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tiket per Prioritas">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData.by_priority} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
            <Bar dataKey="value" name="Jumlah" radius={[6, 6, 0, 0]}>
              {chartData.by_priority.map((_, i) => (
                <Cell key={i} fill={COLORS.priority[i % COLORS.priority.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Kepatuhan SLA (Gangguan Jaringan Telkom)">
        {chartData.sla_compliance && chartData.sla_compliance.some(d => d.value > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={chartData.sla_compliance.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                {chartData.sla_compliance.map((_, i) => (
                  <Cell key={i} fill={COLORS.sla[i % COLORS.sla.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-slate-500 text-sm italic">
            Belum ada data penyelesaian SLA untuk bulan ini
          </div>
        )}
      </ChartCard>
    </div>
  );
};

const ChartCard = ({ title, children }) => (
  <div className="glass-card rounded-xl p-5">
    <h4 className="text-sm font-medium text-slate-400 mb-3">{title}</h4>
    {children}
  </div>
);

// ========== Komponen Baru: Analytics Section ==========
const AnalyticsSection = ({ analytics }) => {
  if (!analytics) return null;

  const medals = [
    { color: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/50' }, // Gold
    { color: 'text-slate-300', bg: 'bg-slate-300/20', border: 'border-slate-300/50' },    // Silver
    { color: 'text-amber-600', bg: 'bg-amber-600/20', border: 'border-amber-600/50' },    // Bronze
    { color: 'text-blue-400', bg: 'bg-blue-400/20', border: 'border-blue-400/50' },       // Runner Up
  ];

  return (
    <div className="space-y-6">
      {/* Leaderboard EOS */}
      <div className="glass-card rounded-xl p-6 border border-slate-700/50 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
        <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Leaderboard Teknisi Lapangan (EOS) Terbaik
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          {analytics.top_eos?.map((eos, idx) => (
            <div key={eos.eos_id} className={`p-4 rounded-xl border bg-slate-800/80 flex flex-col items-center text-center relative overflow-hidden ${medals[idx]?.border || 'border-slate-700'}`}>
              <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full ${medals[idx]?.bg || 'bg-slate-700'} blur-xl opacity-50`}></div>
              <Trophy className={`w-8 h-8 mb-2 ${medals[idx]?.color || 'text-slate-400'}`} />
              <h4 className="font-bold text-white text-sm truncate w-full">{eos.name}</h4>
              <p className="text-xs text-slate-400 mb-3 font-medium">Peringkat #{idx + 1}</p>
              
              <div className="w-full grid grid-cols-3 gap-2 text-[9px] uppercase font-bold text-slate-500 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                <div>
                  <span className="block text-emerald-400 text-base mb-0.5">{eos.ticket_count}</span>
                  Tiket Selesai
                </div>
                <div>
                  <span className="block text-cyan-400 text-base mb-0.5">{eos.avg_response_minutes}</span>
                  Respon (m)
                </div>
                <div>
                  <span className="block text-rose-400 text-base mb-0.5">{eos.avg_recovery_minutes}</span>
                  Perbaikan (m)
                </div>
              </div>
            </div>
          ))}
          {analytics.top_eos?.length === 0 && (
             <p className="text-slate-500 col-span-4 text-center py-4 italic">Belum ada data tiket yang diselesaikan oleh teknisi.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Potensi Gangguan / Prediksi */}
        <div className="glass-card rounded-xl p-6 border border-rose-500/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Waspada Potensi Gangguan 
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            {analytics.predictions?.length > 0 ? analytics.predictions.map((p, i) => (
              <div key={i} className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <div className="flex justify-between items-start mb-1.5">
                  <h4 className="font-bold text-rose-400 text-sm">{p.name}</h4>
                  <span className="text-[10px] bg-rose-500 text-white px-2.5 py-0.5 rounded-full font-bold shadow-[0_0_10px_rgba(244,63,94,0.5)]">
                    {p.recent_issue_count}x Rusak Bulan Ini
                  </span>
                </div>
                <p className="text-xs text-slate-300 flex items-center gap-1.5 mb-2.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-300" /> {p.location} ({p.service_type})
                </p>
                <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded border border-rose-500/20 leading-relaxed">
                  💡 <b className="text-rose-400">Saran Sistem:</b> {p.saran}
                </div>
              </div>
            )) : (
              <div className="text-center py-10 text-slate-500 bg-slate-800/30 rounded-lg border border-slate-700/50">
                <Zap className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
                <p>Tidak ada titik layanan yang sering rusak berulang.</p>
              </div>
            )}
          </div>
        </div>

        {/* Top Error Points */}
        <div className="glass-card rounded-xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" />
            Top 10 Titik Rawan Gangguan
          </h3>
          <div className="overflow-x-auto max-h-80 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-[10px] uppercase bg-slate-800/80 text-slate-400 sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="px-3 py-3 rounded-tl-lg">Titik Layanan</th>
                  <th className="px-3 py-3">Layanan</th>
                  <th className="px-3 py-3 rounded-tr-lg text-center">Total Tiket</th>
                </tr>
              </thead>
              <tbody>
                {analytics.top_error_points?.map((point, i) => (
                  <tr key={point.service_point_id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-white">{point.name}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {point.location}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] font-bold uppercase bg-slate-700 px-2 py-1 rounded text-slate-300">
                        {point.service_type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="font-black text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full text-xs">
                        {point.ticket_count}
                      </span>
                    </td>
                  </tr>
                ))}
                {analytics.top_error_points?.length === 0 && (
                  <tr><td colSpan="3" className="text-center py-8 text-slate-500 italic">Belum ada data histori gangguan.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== Shared Components ==========
const StatCard = ({ icon: Icon, label, value, color }) => {
  const colors = {
    rose: 'bg-rose-500/20 text-rose-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    amber: 'bg-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/20 text-emerald-400'
  };
  return (
    <div className="glass-card rounded-xl p-6 hover:scale-[1.02] transition-transform shadow-lg" data-testid={`stat-${label.replace(/\s/g, '-').toLowerCase()}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

const RecentTickets = ({ tickets, showLogbook, inline }) => {
  if (!tickets || tickets.length === 0) {
    return inline ? (
      <p className="text-slate-400 text-center py-8 italic">Tidak ada histori tiket</p>
    ) : (
      <div className="glass-card rounded-xl p-6">
        <p className="text-slate-400 text-center py-8 italic">Tidak ada histori tiket</p>
      </div>
    );
  }

  const content = (
    <>
      {!inline && <h3 className="text-lg font-semibold text-white mb-4">Tiket Terbaru</h3>}
      <div className="space-y-3">
        {tickets.slice(0, 5).map((ticket) => {
          const ServiceIcon = serviceIcons[ticket.service_type] || Ticket;
          return (
            <Link
              key={ticket.id}
              to={showLogbook && ticket.status === 'assigned' ? `/tickets/${ticket.id}/logbook` : `/tickets/${ticket.id}`}
              className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 transition-colors border border-slate-700/30"
              data-testid={`ticket-item-${ticket.id}`}
            >
              <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                <ServiceIcon className="w-5 h-5 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{ticket.title}</p>
                <p className="text-xs text-slate-500 mono">{ticket.id}</p>
              </div>
              <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase bg-slate-700/50 text-slate-300">
                {statusLabels[ticket.status] || ticket.status}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );

  return inline ? content : <div className="glass-card rounded-xl p-6">{content}</div>;
};

export default DashboardPage;