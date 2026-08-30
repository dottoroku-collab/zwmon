import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  Ticket, 
  Plus, 
  Search, 
  Filter,
  Camera,
  Server,
  Megaphone,
  Clock,
  ArrowUpDown,
  Trash2 // <-- Ikon Trash2 sudah ditambahkan di sini
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  pending_verification: 'Menunggu Verifikasi AM',
  escalated: 'Dieskalasi',
  closed: 'Selesai'
};

const serviceIcons = {
  cctv: Camera,
  skpd: Server,
  ip_speaker: Megaphone
};

const serviceNames = {
  cctv: 'CCTV',
  skpd: 'Internet SKPD',
  ip_speaker: 'IP Speaker'
};

const priorityLabels = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
  critical: 'Kritis'
};

const TicketListPage = () => {
  const { user, api } = useApp();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.getTickets();
      setTickets(response.data.tickets || []);
    } catch (error) {
      toast.error('Gagal memuat daftar tiket');
    } finally {
      setLoading(false);
    }
  };

  // Fungsi khusus untuk hapus tiket (Ditambahkan di sini)
  const handleDeleteTicket = async (id, e) => {
    if (e) e.preventDefault(); // Supaya tidak masuk ke halaman detail pas di-klik
    
    if (!window.confirm('Tabe, yakin ki mau menghapus tiket ini secara permanen?')) return;
    
    try {
      await api.deleteTicket(id); 
      toast.success('Tiket berhasil dihapus!');
      fetchTickets(); // Refresh daftar tiket
    } catch (error) {
      toast.error('Gagal menghapus tiket: ' + (error.response?.data?.message || error.message));
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    // Tambahkan ?. supaya kalau ada data kosong dari DB, React tidak ngambek
    const title = ticket.title?.toLowerCase() || '';
    const id = ticket.id?.toLowerCase() || '';
    const location = ticket.location?.toLowerCase() || '';
    const search = searchQuery.toLowerCase();

    const matchesSearch = title.includes(search) || id.includes(search) || location.includes(search);
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    
    // Samakan huruf besar/kecil supaya aman kalau dari DB tersimpan "SKPD" atau "skpd"
    const matchesService = serviceFilter === 'all' || (ticket.service_type?.toLowerCase() === serviceFilter.toLowerCase());
    
    return matchesSearch && matchesStatus && matchesService;
  });

  const canCreateTicket = ['client', 'helpdesk'].includes(user?.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Daftar Tiket</h1>
          <p className="text-slate-400">Kelola dan pantau semua tiket gangguan</p>
        </div>
        {canCreateTicket && (
          <Link to="/tickets/create" data-testid="create-ticket-btn">
            <Button className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Buat Tiket Baru
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Cari tiket berdasarkan ID, judul, atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark pl-10 h-11 text-white"
              data-testid="search-tickets"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-48 input-dark h-11" data-testid="filter-status">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="open">Terbuka</SelectItem>
              <SelectItem value="assigned">Ditugaskan</SelectItem>
              <SelectItem value="in_progress">Sedang Dikerjakan</SelectItem>
              <SelectItem value="pending_verification">Menunggu Verifikasi AM</SelectItem>
              <SelectItem value="escalated">Dieskalasi</SelectItem>
              <SelectItem value="closed">Selesai</SelectItem>
            </SelectContent>
          </Select>

          {/* Service Filter */}
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-full lg:w-48 input-dark h-11" data-testid="filter-service">
              <SelectValue placeholder="Layanan" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Semua Layanan</SelectItem>
              <SelectItem value="cctv">CCTV</SelectItem>
              <SelectItem value="skpd">Internet SKPD</SelectItem>
              <SelectItem value="ip_speaker">IP Speaker</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Ticket List */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-12 gap-4 p-4 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 font-medium border-b border-slate-800">
          <div className="col-span-3 flex items-center gap-1">
            <ArrowUpDown className="w-3 h-3" />
            Tiket
          </div>
          <div className="col-span-2">Layanan</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Prioritas</div>
          <div className="col-span-2">Tanggal</div>
          <div className="col-span-1">Aksi</div>
        </div>

        {/* Ticket Rows */}
        {filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Tidak ada tiket ditemukan</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredTickets.map((ticket) => {
              const ServiceIcon = serviceIcons[ticket.service_type] || Ticket;
              
              return (
                <Link
                  key={ticket.id}
                  to={user?.role === 'eos' && ticket.status === 'assigned' 
                    ? `/tickets/${ticket.id}/logbook` 
                    : `/tickets/${ticket.id}`}
                  className="block p-4 hover:bg-white/5 transition-colors"
                  data-testid={`ticket-row-${ticket.id}`}
                >
                  {/* Desktop View */}
                  <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <p className="text-white font-medium truncate">{ticket.title}</p>
                      <p className="text-xs text-slate-500 mono mt-1">{ticket.id}</p>
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <ServiceIcon className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">{serviceNames[ticket.service_type]}</span>
                    </div>
                    <div className="col-span-2">
                      <span className={`status-${ticket.status} px-3 py-1 rounded-full text-xs font-medium`}>
                        {statusLabels[ticket.status]}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`priority-${ticket.priority} px-3 py-1 rounded-full text-xs font-medium`}>
                        {priorityLabels[ticket.priority]}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2 text-sm text-slate-400">
                      <Clock className="w-4 h-4" />
                      {new Date(ticket.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </div>
                    
                    {/* Aksi Column - Diupdate dengan tombol Hapus */}
                    <div className="col-span-1 flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white px-2">
                        Detail
                      </Button>
                      
                      {(user?.role === 'admin' || user?.role === 'am') && (
                        <button
                          onClick={(e) => handleDeleteTicket(ticket.id, e)}
                          className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          title="Hapus Tiket"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile View */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                          <ServiceIcon className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{ticket.title}</p>
                          <p className="text-xs text-slate-500 mono">{ticket.id}</p>
                        </div>
                      </div>
                      
                      {/* Diupdate dengan tombol Hapus untuk versi HP */}
                      <div className="flex items-center gap-2">
                        <span className={`status-${ticket.status} px-2 py-1 rounded text-xs font-medium`}>
                          {statusLabels[ticket.status]}
                        </span>
                        {(user?.role === 'admin' || user?.role === 'am') && (
                          <button
                            onClick={(e) => handleDeleteTicket(ticket.id, e)}
                            className="p-1 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Hapus Tiket"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`priority-${ticket.priority} px-2 py-0.5 rounded text-xs`}>
                        {priorityLabels[ticket.priority]}
                      </span>
                      <span className="text-slate-500">
                        {new Date(ticket.created_at).toLocaleDateString('id-ID')}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
        <span>Total: {filteredTickets.length} tiket</span>
        <span>Terbuka: {filteredTickets.filter(t => t.status === 'open').length}</span>
        <span>Selesai: {filteredTickets.filter(t => t.status === 'closed').length}</span>
      </div>
    </div>
  );
};

export default TicketListPage;