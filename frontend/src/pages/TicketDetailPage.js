import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Camera, 
  Server, 
  Megaphone,
  MapPin,
  Clock,
  User,
  AlertTriangle,
  CheckCircle,
  Star,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Zap,
  Wifi,
  Edit // <--- TAMBAHAN IMPORT ICON EDIT
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

const statusLabels = {
  open: 'Terbuka',
  assigned: 'Ditugaskan',
  in_progress: 'Sedang Dikerjakan',
  pending_review: 'Menunggu Review',
  pending_verification: 'Menunggu Verifikasi AM',
  escalated: 'Dieskalasi',
  closed: 'Selesai'
};

const statusColors = {
  open: 'bg-blue-500/20 text-blue-400',
  assigned: 'bg-amber-500/20 text-amber-400',
  in_progress: 'bg-cyan-500/20 text-cyan-400',
  pending_review: 'bg-purple-500/20 text-purple-400',
  pending_verification: 'bg-orange-500/20 text-orange-400',
  escalated: 'bg-rose-500/20 text-rose-400',
  closed: 'bg-emerald-500/20 text-emerald-400'
};

const serviceIcons = {
  cctv: Camera,
  skpd: Server,
  ip_speaker: Megaphone
};

const serviceNames = {
  cctv: 'Jaringan CCTV',
  skpd: 'Internet Dedicated SKPD',
  ip_speaker: 'IP Speaker'
};

const priorityLabels = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
  critical: 'Kritis'
};

const finalStatusLabels = {
  normal_user: 'Normal di Sisi Pengguna',
  normal_telkom_pending: 'Normal Sisi Telkom (Pending Kominfo)',
  escalation_core: 'Eskalasi Tim Core'
};

const scenarioLabels = {
  A: 'Gangguan Jaringan Telkom',
  B: 'Gangguan Sisi Pengguna / Force Majeure'
};

const TicketDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, api } = useApp();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eosUsers, setEosUsers] = useState([]);
  const [selectedEos, setSelectedEos] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  const [forceClosing, setForceClosing] = useState(false);
  
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  const [amMessage, setAmMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);

  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const [verifyComment, setVerifyComment] = useState('');
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);

  // ---> TAMBAHAN STATE UNTUK KOREKSI LOGBOOK <---
  const [correctionComment, setCorrectionComment] = useState('');
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [showCorrectionDialog, setShowCorrectionDialog] = useState(false);

  useEffect(() => {
    fetchTicket();
    const userRole = user?.role?.toLowerCase() || '';
    if (['admin', 'helpdesk'].includes(userRole)) {
      fetchEosUsers();
    }
  }, [id, user]);

  const fetchTicket = async () => {
    try {
      const response = await api.getTicket(id);
      setTicket(response.data.ticket);
    } catch (error) {
      toast.error('Gagal memuat detail tiket');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchEosUsers = async () => {
    try {
      const response = await api.getEosUsers();
      setEosUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to fetch EOS users');
    }
  };

  const handleAssign = async () => {
    if (!selectedEos) {
      toast.error('Pilih EOS terlebih dahulu');
      return;
    }
    setAssigning(true);
    try {
      await api.assignTicket(id, selectedEos);
      toast.success('Tiket berhasil ditugaskan');
      fetchTicket();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menugaskan tiket');
    } finally {
      setAssigning(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await api.verifyTicket(id, verifyComment);
      toast.success('Tiket berhasil diverifikasi dan ditutup');
      setShowVerifyDialog(false);
      fetchTicket();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal memverifikasi tiket');
    } finally {
      setVerifying(false);
    }
  };

  const handleForceCloseAM = async () => {
    if (!window.confirm('Tabe, yakin ki mau menyelesaikan tiket ini secara langsung?')) return;
    
    setForceClosing(true);
    try {
      await api.updateTicket(id, { status: 'closed' });
      toast.success('Tiket berhasil diselesaikan secara paksa oleh AM!');
      fetchTicket();
    } catch (error) {
      toast.error('Gagal menyelesaikan tiket: ' + (error.response?.data?.detail || error.message));
    } finally {
      setForceClosing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) {
      toast.error('Masukkan alasan penolakan');
      return;
    }
    setRejecting(true);
    try {
      await api.rejectTicket(id, rejectComment);
      toast.success('Tiket ditolak dan dikembalikan ke EOS');
      setShowRejectDialog(false);
      setRejectComment('');
      fetchTicket();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menolak tiket');
    } finally {
      setRejecting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!amMessage.trim()) {
      toast.error('Masukkan pesan');
      return;
    }
    setSendingMessage(true);
    try {
      await api.sendAMMessage(id, amMessage);
      toast.success('Pesan berhasil dikirim ke client');
      setAmMessage('');
      setShowMessageDialog(false);
      fetchTicket();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengirim pesan');
    } finally {
      setSendingMessage(false);
    }
  };

  // ---> FUNGSI BARU UNTUK KOREKSI LOGBOOK <---
  const handleRequestCorrection = async () => {
    if (!correctionComment.trim()) {
      toast.error('Tabe, masukkan alasan koreksinya dulu Boska');
      return;
    }
    setIsCorrecting(true);
    try {
      // Ubah status tiket kembali ke in_progress agar EOS bisa buka form logbook lagi
      await api.updateTicket(id, { status: 'in_progress' });
      
      // Kirim pesan otomatis ke AM Message sebagai jejak/instruksi perbaikan
      await api.sendAMMessage(id, `[KOREKSI LOGBOOK]: ${correctionComment}`);
      
      toast.success('Berhasil! Akses logbook sudah terbuka lagi untuk teknisi (EOS)');
      setShowCorrectionDialog(false);
      setCorrectionComment('');
      fetchTicket();
    } catch (error) {
      toast.error('Gagal membuka akses koreksi: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await api.submitReview({
        ticket_id: id,
        rating: reviewRating,
        comment: reviewComment
      });
      toast.success('Review berhasil dikirim');
      setShowReviewDialog(false);
      fetchTicket();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengirim review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      toast.loading('Menyiapkan dokumen BAPG...');
      const token = localStorage.getItem('token') || localStorage.getItem('access_token');
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const endpoint = `${baseUrl}/tickets/${id}/pdf`.replace(/([^:]\/)\/+/g, "$1");
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf'
        }
      });

      if (!response.ok) {
        const textError = await response.text();
        let errorMessage = `HTTP Error ${response.status}`;
        try {
           const jsonError = JSON.parse(textError);
           errorMessage = jsonError.detail || jsonError.message || textError;
        } catch (e) {
           errorMessage = textError;
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BAPG_${ticket.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.dismiss();
      toast.success('BAPG berhasil diunduh!');
      
    } catch (error) {
      toast.dismiss();
      console.error("ALASAN ASLI GAGAL DOWNLOAD:", error.message);
      
      if (error.message.includes("Load failed") || error.message.includes("Failed to fetch")) {
        toast.error("Gagal BAPG: Alamat server nyasar atau diblokir (CORS)!");
      } else {
        toast.error(`Gagal BAPG: ${error.message}`);
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleString('id-ID');
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!ticket) return null;

  const ServiceIcon = serviceIcons[ticket.service_type] || Camera;
  
  const userRole = user?.role?.toLowerCase() || '';
  const canAssign = ['admin', 'helpdesk'].includes(userRole) && ticket.status === 'open';
  const canVerify = userRole === 'am' && ticket.status === 'pending_verification';
  const canReject = userRole === 'am' && ticket.status === 'pending_verification';
  const canSendMessage = userRole === 'am' && ticket.status === 'pending_verification';
  const canReview = userRole === 'client' && ticket.status === 'closed' && ticket.client_id === user?.id;
  const canFillLogbook = userRole === 'eos' && ['assigned', 'in_progress'].includes(ticket.status) && ticket.assigned_to === user?.id;
  const canForceClose = userRole === 'am' && ticket.status !== 'closed'; 
  const canDownloadBAPG = ticket?.status === 'closed' && ['admin', 'am', 'helpdesk'].includes(userRole);
  
  // ---> SYARAT TOMBOL MINTA KOREKSI: Hanya AM/Admin & Tiket harus sudah berstatus Selesai (closed) <---
  const canRequestCorrection = ['admin', 'am'].includes(userRole) && ticket.status === 'closed';

  const logbook = ticket.logbook || {};

  return (
    <div className="space-y-6 animate-fade-in" data-testid="ticket-detail-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/tickets')}
          className="text-slate-400 hover:text-white"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{ticket.title}</h1>
          <p className="text-sm text-slate-500 mono">{ticket.id}</p>
        </div>
        <span className={`px-4 py-2 rounded-lg text-sm font-medium ${statusColors[ticket.status] || 'bg-slate-700 text-slate-300'}`} data-testid="ticket-status">
          {statusLabels[ticket.status] || ticket.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Info */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-slate-800 flex items-center justify-center">
                <ServiceIcon className="w-7 h-7 text-cyan-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">{serviceNames[ticket.service_type]}</p>
                <p className="text-slate-400">{ticket.location}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-slate-400 mb-2">Deskripsi</h3>
                <p className="text-white">{ticket.description}</p>
              </div>
              {ticket.initial_indication && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-1">Indikasi Gangguan</h3>
                  <p className="text-amber-400">{ticket.initial_indication}</p>
                </div>
              )}
              {ticket.photos && ticket.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-2">Foto Bukti Awal</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {ticket.photos.map((photo, index) => (
                      <img key={index} src={photo} alt={`Bukti ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Digital Logbook Display */}
          {logbook.phase2 && (
            <div className="glass-card rounded-xl p-6" data-testid="logbook-section">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white">Digital Logbook</h3>
              </div>
              <div className="space-y-4">
                <LogbookPhaseCard
                  title="Tahap 1: Pelaporan Awal"
                  color="cyan"
                  items={[
                    { label: 'Waktu Lapor', value: formatDate(logbook.phase1?.open_ticket_time || ticket.created_at) },
                    { label: 'Indikasi', value: logbook.phase1?.initial_indication || ticket.initial_indication || '-' }
                  ]}
                  photos={logbook.phase1?.photos}
                />

                <LogbookPhaseCard
                  title="Tahap 2: Investigasi Lapangan"
                  color="amber"
                  items={[
                    { label: 'Waktu Tiba', value: formatDate(logbook.phase2?.arrival_time) },
                    ...(ticket.service_type === 'cctv' ? [
                      { label: 'Kelistrikan', value: logbook.phase2?.electricity_check || '-' },
                      { label: 'Indikator Modem', value: logbook.phase2?.modem_indicator || '-' }
                    ] : [
                      { label: 'Download', value: logbook.phase2?.bypass_download ? `${logbook.phase2.bypass_download} Mbps` : '-' },
                      { label: 'Upload', value: logbook.phase2?.bypass_upload ? `${logbook.phase2.bypass_upload} Mbps` : '-' },
                      { label: 'Ping', value: logbook.phase2?.bypass_ping ? `${logbook.phase2.bypass_ping} ms` : '-' }
                    ])
                  ]}
                  photos={logbook.phase2?.photos}
                />

                {logbook.phase3 && (
                  <LogbookPhaseCard
                    title="Tahap 3: Klasifikasi Gangguan"
                    color={logbook.phase3.scenario === 'A' ? 'rose' : 'emerald'}
                    items={[
                      { label: 'Klasifikasi', value: scenarioLabels[logbook.phase3.scenario] || logbook.phase3.scenario },
                      { label: 'Detail', value: logbook.phase3.scenario_detail || '-' }
                    ]}
                    photos={logbook.phase3?.photos}
                  />
                )}

                {logbook.phase4 && (
                  <LogbookPhaseCard
                    title="Tahap 4: Tindakan Perbaikan"
                    color="cyan"
                    items={[
                      { label: 'Tindakan', value: logbook.phase4.action_taken || '-' },
                      ...(logbook.phase4.category ? [{ label: 'Kategori', value: logbook.phase4.category }] : [])
                    ]}
                    photos={logbook.phase4?.photos}
                  />
                )}

                {logbook.phase5 && (
                  <LogbookPhaseCard
                    title="Tahap 5: Penyelesaian"
                    color="emerald"
                    items={[
                      { label: 'Waktu Selesai', value: formatDate(logbook.phase5.completion_time) },
                      { label: 'Status Akhir', value: finalStatusLabels[logbook.phase5.final_status] || logbook.phase5.final_status || '-' },
                      { label: 'Response Time', value: logbook.phase5.response_time_minutes != null ? `${logbook.phase5.response_time_minutes} menit` : '-' },
                      { label: 'Recovery Time', value: logbook.phase5.recovery_time_minutes != null ? `${logbook.phase5.recovery_time_minutes} menit` : '-' },
                      { label: 'Total Downtime', value: logbook.phase5.total_downtime_minutes != null 
                          ? (ticket.scenario === 'B' 
                              ? `${logbook.phase5.total_downtime_minutes} menit (Gangguan Sisi Pengguna / Force Majeure - Pengecualian SLA)` 
                              : `${logbook.phase5.total_downtime_minutes} menit`) 
                          : '-' },
                      ...(logbook.phase5.notes ? [{ label: 'Catatan', value: logbook.phase5.notes }] : [])
                    ]}
                    photos={logbook.phase5?.photos}
                  />
                )}
              </div>
            </div>
          )}

          {ticket.am_messages && ticket.am_messages.length > 0 && (
            <div className="glass-card rounded-xl p-6" data-testid="am-messages">
              <div className="flex items-center gap-3 mb-4">
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Pesan Account Manager</h3>
              </div>
              <div className="space-y-3">
                {ticket.am_messages.map((msg, index) => (
                  <div className="bg-slate-800/30 rounded-lg p-4" key={index}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-amber-400">{msg.from_name}</span>
                      <span className="text-xs text-slate-500">{formatDate(msg.sent_at)}</span>
                    </div>
                    <p className="text-sm text-slate-300">{msg.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ticket.review && (
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Review Client</h3>
              </div>
              <div className="flex items-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className={`w-5 h-5 ${star <= ticket.review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                ))}
                <span className="text-white ml-2">{ticket.review.rating}/5</span>
              </div>
              <p className="text-slate-300">{ticket.review.comment}</p>
              <p className="text-xs text-slate-500 mt-2">
                Oleh {ticket.review.client_name} - {formatDate(ticket.review.submitted_at)}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-4 mt-4">
            {canFillLogbook && (
              <Link to={`/tickets/${id}/logbook`} className="flex-1" data-testid="fill-logbook-btn">
                <Button className="w-full btn-primary h-12">
                  <FileText className="w-5 h-5 mr-2" />
                  Isi Logbook
                </Button>
              </Link>
            )}

            {canReview && (
              <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
                <DialogTrigger asChild>
                  <Button className="flex-1 btn-primary h-12" data-testid="give-review-btn">
                    <Star className="w-5 h-5 mr-2" />
                    Beri Review
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Beri Review</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <label className="text-sm text-slate-400 block mb-2">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} onClick={() => setReviewRating(star)} className="p-1" data-testid={`rating-star-${star}`}>
                            <Star className={`w-8 h-8 transition-colors ${star <= reviewRating ? 'text-amber-400 fill-amber-400' : 'text-slate-600 hover:text-slate-400'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 block mb-2">Komentar</label>
                      <Textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Tulis komentar Anda..."
                        className="input-dark min-h-[100px] text-white"
                        data-testid="review-comment"
                      />
                    </div>
                    <Button onClick={handleSubmitReview} disabled={submittingReview} className="w-full btn-primary" data-testid="submit-review-btn">
                      {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kirim Review'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* ---> TAMBAHAN: TOMBOL MINTA KOREKSI LOGBOOK <--- */}
            {canRequestCorrection && (
              <Dialog open={showCorrectionDialog} onOpenChange={setShowCorrectionDialog}>
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-violet-600 hover:bg-violet-700 text-white h-12" data-testid="request-correction-btn">
                    <Edit className="w-5 h-5 mr-2" />
                    Minta Koreksi Logbook
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-violet-400" />
                      Kembalikan Tiket ke Teknisi (Koreksi)
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <p className="text-sm text-slate-400">
                      Ini akan mengubah status tiket kembali ke <strong>Sedang Dikerjakan</strong> agar teknisi (EOS) bisa membuka ulang form logbook dan memperbaiki datanya.
                    </p>
                    <Textarea
                      value={correctionComment}
                      onChange={(e) => setCorrectionComment(e.target.value)}
                      placeholder="Jelaskan bagian mana yang perlu diperbaiki (contoh: Jam Waktu Selesai tolong disesuaikan)..."
                      className="input-dark min-h-[100px] text-white"
                    />
                    <Button
                      onClick={handleRequestCorrection}
                      disabled={isCorrecting || !correctionComment.trim()}
                      className="w-full bg-violet-600 hover:bg-violet-700"
                    >
                      {isCorrecting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <><Edit className="w-4 h-4 mr-2" />Buka Akses Logbook</>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {canVerify && (
              <>
                <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12" data-testid="verify-btn">
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Verifikasi & Tutup
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                      <DialogTitle>Verifikasi & Tutup Tiket</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <p className="text-sm text-slate-400">Berikan komentar atau pesan penyemangat untuk tim.</p>
                      <Textarea
                        value={verifyComment}
                        onChange={(e) => setVerifyComment(e.target.value)}
                        placeholder="Komentar verifikasi (opsional)..."
                        className="input-dark min-h-[100px] text-white"
                        data-testid="verify-comment-input"
                      />
                      <Button
                        onClick={handleVerify}
                        disabled={verifying}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        data-testid="confirm-verify-btn"
                      >
                        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                          <><CheckCircle className="w-4 h-4 mr-2" />Verifikasi & Tutup</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 bg-rose-600 hover:bg-rose-700 h-12" data-testid="reject-btn">
                      <AlertTriangle className="w-5 h-5 mr-2" />
                      Tolak & Kembalikan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                      <DialogTitle>Tolak Tiket</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <p className="text-sm text-slate-400">Tiket akan dikembalikan ke EOS untuk dilengkapi. Berikan alasan penolakan.</p>
                      <Textarea
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        placeholder="Alasan penolakan (wajib)..."
                        className="input-dark min-h-[100px] text-white"
                        data-testid="reject-comment-input"
                      />
                      <Button
                        onClick={handleReject}
                        disabled={rejecting || !rejectComment.trim()}
                        className="w-full bg-rose-600 hover:bg-rose-700"
                        data-testid="confirm-reject-btn"
                      >
                        {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                          <><AlertTriangle className="w-4 h-4 mr-2" />Tolak & Kembalikan ke EOS</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 bg-amber-600 hover:bg-amber-700 h-12" data-testid="send-message-btn">
                      <MessageSquare className="w-5 h-5 mr-2" />
                      Kirim Pesan ke Client
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                      <DialogTitle>Kirim Pesan ke Client</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <p className="text-sm text-slate-400">
                        Kirim pesan ke client jika gangguan bukan dari sisi Telkom atau memerlukan tindakan dari client.
                      </p>
                      <Textarea
                        value={amMessage}
                        onChange={(e) => setAmMessage(e.target.value)}
                        placeholder="Tulis pesan untuk client..."
                        className="input-dark min-h-[120px] text-white"
                        data-testid="am-message-input"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={sendingMessage || !amMessage.trim()}
                        className="w-full bg-amber-600 hover:bg-amber-700"
                        data-testid="send-am-message-btn"
                      >
                        {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                          <><Send className="w-4 h-4 mr-2" />Kirim Pesan</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {canForceClose && (
              <Button
                onClick={handleForceCloseAM}
                disabled={forceClosing}
                className="flex-1 bg-rose-600 hover:bg-rose-700 h-12 text-white"
                data-testid="force-close-btn"
              >
                {forceClosing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                Selesaikan Tiket (AM Override)
              </Button>
            )}

            {canDownloadBAPG && (
              <Button 
                onClick={handleDownloadPDF} 
                className="w-full sm:w-auto flex-1 bg-indigo-600 hover:bg-indigo-700 text-white h-12"
              >
                <FileText className="w-5 h-5 mr-2" />
                Download Laporan BAPG
              </Button>
            )}

          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="glass-card rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Detail Tiket</h3>
            <div className="space-y-4">
              <DetailItem icon={AlertTriangle} label="Prioritas" value={priorityLabels[ticket.priority]} />
              <DetailItem icon={MapPin} label="Lokasi" value={ticket.location} />
              <DetailItem icon={User} label="Pelapor" value={ticket.client_name} />
              <DetailItem icon={Clock} label="Dibuat" value={formatDate(ticket.created_at)} />
              {ticket.assigned_name && (
                <DetailItem icon={User} label="Ditugaskan ke" value={ticket.assigned_name} />
              )}
              {ticket.scenario && (
                <DetailItem icon={AlertTriangle} label="Klasifikasi" value={scenarioLabels[ticket.scenario] || ticket.scenario} />
              )}
              {ticket.final_status && (
                <DetailItem icon={CheckCircle} label="Status Akhir" value={finalStatusLabels[ticket.final_status] || ticket.final_status} />
              )}
              {ticket.total_downtime_minutes != null && (
                <DetailItem icon={Clock} label="Total Downtime" value={
                  ticket.scenario === 'B' 
                    ? `${ticket.total_downtime_minutes} menit (Gangguan Sisi Pengguna / Force Majeure - Pengecualian SLA)`
                    : `${ticket.total_downtime_minutes} menit`
                } />
              )}
              {ticket.closed_at && (
                <DetailItem icon={CheckCircle} label="Selesai" value={formatDate(ticket.closed_at)} />
              )}
            </div>
          </div>

          {canAssign && (
            <div className="glass-card rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Tugaskan ke EOS</h3>
              <div className="space-y-4">
                <Select value={selectedEos || undefined} onValueChange={setSelectedEos}>
                  <SelectTrigger className="input-dark h-11" data-testid="select-eos">
                    <SelectValue placeholder="Pilih EOS" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {eosUsers.map((eos) => (
                      <SelectItem key={eos.id} value={eos.id}>
                        {eos.full_name || eos.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssign}
                  disabled={assigning || !selectedEos}
                  className="w-full btn-primary"
                  data-testid="assign-btn"
                >
                  {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tugaskan Tiket'}
                </Button>
              </div>
            </div>
          )}

          {ticket.status_history && ticket.status_history.length > 0 && (
            <div className="glass-card rounded-xl p-6" data-testid="status-history">
              <h3 className="text-sm font-semibold text-white mb-4">Riwayat Status</h3>
              <div className="space-y-3">
                {ticket.status_history.map((h, i) => (
                  <div key={i} className="relative pl-6 pb-3 border-l-2 border-slate-700 last:border-l-0 last:pb-0">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-cyan-400"></div>
                    <p className="text-xs text-slate-500">{formatDate(h.at)}</p>
                    <p className="text-sm text-white">
                      <span className="text-slate-400">{h.by_name}</span>
                      {' '}({h.role})
                    </p>
                    {h.comment && <p className="text-sm text-cyan-300 mt-1">"{h.comment}"</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ticket.am_rejected && ticket.am_reject_comment && (
            <div className="glass-card rounded-xl p-6 border-l-4 border-rose-500" data-testid="rejection-notice">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-semibold text-rose-400">Ditolak AM</h3>
              </div>
              <p className="text-sm text-slate-300">"{ticket.am_reject_comment}"</p>
              <p className="text-xs text-slate-500 mt-1">{formatDate(ticket.am_rejected_at)}</p>
            </div>
          )}

          {ticket.status !== 'closed' && ticket.sla_deadline && (
            <div className="glass-card rounded-xl p-6 border-l-4 border-amber-500">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">SLA Deadline</h3>
              </div>
              <p className="text-amber-400 mono" data-testid="sla-deadline">
                {formatDate(ticket.sla_deadline)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LogbookPhaseCard = ({ title, color, items, photos }) => {
  const colorMap = {
    cyan: 'border-cyan-500',
    amber: 'border-amber-500',
    rose: 'border-rose-500',
    emerald: 'border-emerald-500'
  };

  return (
    <div className={`bg-slate-800/30 rounded-lg p-4 border-l-4 ${colorMap[color] || 'border-slate-600'}`}>
      <h4 className="text-sm font-medium text-white mb-3">{title}</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {items.map((item, idx) => (
          <div key={idx} className={item.label === 'Detail' || item.label === 'Tindakan' || item.label === 'Catatan' ? 'col-span-2' : ''}>
            <span className="text-slate-500">{item.label}:</span>
            <span className="text-slate-300 ml-2">{item.value}</span>
          </div>
        ))}
      </div>
      {photos && photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {photos.map((photo, i) => (
            <img key={i} src={photo} alt={`Foto ${i + 1}`} className="w-full h-16 object-cover rounded" />
          ))}
        </div>
      )}
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <Icon className="w-5 h-5 text-slate-500 mt-0.5" />
    <div className="flex-1">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  </div>
);

export default TicketDetailPage;