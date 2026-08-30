import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  ArrowLeft, 
  Camera, 
  Server, 
  Megaphone,
  Upload,
  X,
  Loader2,
  CheckCircle,
  Clock,
  Zap,
  Wifi,
  AlertTriangle,
  FileText,
  User // <--- TAMBAHAN IMPORT ICON
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

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

// ---> PERUBAHAN DESKRIPSI TAHAP LOGBOOK <---
const PHASES = [
  { id: 'phase2', name: 'Tahap 2: Investigasi Lapangan', description: 'Pengecekan fisik & uji bypass' },
  { id: 'phase3', name: 'Tahap 3: Klasifikasi Gangguan', description: 'Tentukan klasifikasi penyebab gangguan' },
  { id: 'phase4', name: 'Tahap 4: Tindakan Perbaikan', description: 'Catat tindakan yang dilakukan' },
  { id: 'phase5', name: 'Tahap 5: Penyelesaian', description: 'Status akhir & waktu selesai' }
];

const LogbookPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api, API, user, token } = useApp();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  
  const [phase2, setPhase2] = useState({
    arrival_time: new Date().toISOString().slice(0, 16),
    electricity_check: '',
    modem_indicator: '',
    bypass_download: '',
    bypass_upload: '',
    bypass_ping: '',
    photos: []
  });

  const [phase3, setPhase3] = useState({
    scenario: '',
    scenario_detail: '',
    photos: []
  });

  const [phase4, setPhase4] = useState({
    action_taken: '',
    category: '',
    photos: []
  });

  const [phase5, setPhase5] = useState({
    completion_time: new Date().toISOString().slice(0, 16),
    final_status: '',
    notes: '',
    photos: []
  });

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const response = await api.getTicket(id);
      const ticketData = response.data.ticket;
      
      if (ticketData.assigned_to !== user?.id) {
        toast.error('Tiket ini tidak ditugaskan kepada Anda');
        navigate('/tickets');
        return;
      }
      
      if (!['assigned', 'in_progress'].includes(ticketData.status)) {
        toast.error('Tiket ini tidak dalam status yang dapat diisi logbook');
        navigate(`/tickets/${id}`);
        return;
      }
      
      setTicket(ticketData);
      
      if (ticketData.logbook?.phase2) setPhase2(prev => ({ ...prev, ...ticketData.logbook.phase2 }));
      if (ticketData.logbook?.phase3) setPhase3(prev => ({ ...prev, ...ticketData.logbook.phase3 }));
      if (ticketData.logbook?.phase4) setPhase4(prev => ({ ...prev, ...ticketData.logbook.phase4 }));
      if (ticketData.logbook?.phase5) setPhase5(prev => ({ ...prev, ...ticketData.logbook.phase5 }));
    } catch (error) {
      toast.error('Gagal memuat detail tiket');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (phase, setPhase, e) => {
    const files = Array.from(e.target.files);
    const fileInput = e.target;
    if (files.length === 0) return;

    setIsUploadingPhoto(true);
    const uploadedUrls = [];

    try {
      for (const file of files) {
        const uploadData = new FormData();
        uploadData.append('file', file);

        const res = await axios.post(`${API}/upload-photo`, uploadData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.data && res.data.photo_url) {
          uploadedUrls.push(res.data.photo_url);
        }
      }

      setPhase(prev => ({
        ...prev,
        photos: [...(prev.photos || []), ...uploadedUrls]
      }));
      toast.success(`${uploadedUrls.length} foto logbook berhasil diunggah`);
    } catch (error) {
      console.error("Error Upload Logbook:", error);
      toast.error('Gagal mengunggah foto. Pastikan ukuran dan formatnya sesuai.');
    } finally {
      setIsUploadingPhoto(false);
      fileInput.value = null;
    }
  };

  const removePhoto = (phase, setPhase, index) => {
    setPhase(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const calculateTimes = () => {
    try {
      const openTimeStr = ticket?.logbook?.phase1?.open_ticket_time || ticket?.created_at;
      const openTime = openTimeStr ? new Date(openTimeStr) : new Date();
      const arrivalTime = phase2.arrival_time ? new Date(phase2.arrival_time) : new Date();
      const completionTime = phase5.completion_time ? new Date(phase5.completion_time) : new Date();
      
      const responseMinutes = Math.max(0, Math.round((arrivalTime - openTime) / 60000));
      const recoveryMinutes = Math.max(0, Math.round((completionTime - arrivalTime) / 60000));
      const totalDowntime = Math.max(0, Math.round((completionTime - openTime) / 60000));
      
      return { responseMinutes, recoveryMinutes, totalDowntime };
    } catch (e) {
      return { responseMinutes: 0, recoveryMinutes: 0, totalDowntime: 0 };
    }
  };

  const savePhase = async (phaseNum) => {
    setSubmitting(true);
    try {
      const logbookData = { ticket_id: id };
      
      if (phaseNum >= 2) {
        logbookData.phase2 = {
          ...phase2,
          arrival_time: new Date(phase2.arrival_time).toISOString(),
          bypass_download: phase2.bypass_download ? parseFloat(phase2.bypass_download) : null,
          bypass_upload: phase2.bypass_upload ? parseFloat(phase2.bypass_upload) : null,
          bypass_ping: phase2.bypass_ping ? parseFloat(phase2.bypass_ping) : null,
        };
      }
      
      if (phaseNum >= 3) logbookData.phase3 = phase3;
      if (phaseNum >= 4) logbookData.phase4 = phase4;
      
      if (phaseNum >= 5) {
        const times = calculateTimes();
        logbookData.phase5 = {
          ...phase5,
          completion_time: new Date(phase5.completion_time).toISOString(),
          response_time_minutes: times.responseMinutes,
          recovery_time_minutes: times.recoveryMinutes,
          total_downtime_minutes: phase3.scenario === 'A' ? times.totalDowntime : 0
        };
      }
      
      await api.submitLogbook(logbookData);
      toast.success('Logbook berhasil disimpan');
      
      if (phaseNum === 5) {
        navigate(`/tickets/${id}`);
      } else {
        setCurrentPhase(phaseNum - 1);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menyimpan logbook');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(`/tickets/${id}`)}
          className="text-slate-400 hover:text-white"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Digital Logbook</h1>
          <p className="text-sm text-slate-500 mono">{ticket.id}</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
          <ServiceIcon className="w-6 h-6 text-cyan-400" />
        </div>
        <div className="flex-1">
          <p className="text-white font-medium">{ticket.title}</p>
          <p className="text-sm text-slate-400">{serviceNames[ticket.service_type]} - {ticket.location}</p>
          <p className="text-xs text-slate-500">Bandwidth: {ticket.bandwidth} Mbps</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 border-l-4 border-cyan-500">
        <h3 className="text-sm font-medium text-cyan-400 mb-2">Tahap 1: Pelaporan Awal (War Room)</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Waktu Lapor:</span>
            <span className="text-white ml-2">
              {ticket.logbook?.phase1?.open_ticket_time || ticket.created_at 
                ? new Date(ticket.logbook?.phase1?.open_ticket_time || ticket.created_at).toLocaleString('id-ID')
                : '-'}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Indikasi:</span>
            <span className="text-white ml-2">{ticket.initial_indication || '-'}</span>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-slate-400">Progress Logbook</span>
          <span className="text-sm text-slate-400">{Math.round(((currentPhase + 1) / PHASES.length) * 100)}%</span>
        </div>
        <div className="flex gap-2">
          {PHASES.map((phase, index) => (
            <button
              key={phase.id}
              onClick={() => setCurrentPhase(index)}
              className={`flex-1 h-2 rounded-full transition-colors ${
                index <= currentPhase ? 'bg-rose-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          {PHASES.map((phase, index) => (
            <span key={phase.id} className={index === currentPhase ? 'text-rose-400' : ''}>
              {index + 2}
            </span>
          ))}
        </div>
      </div>

      {currentPhase === 0 && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <Clock className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Tahap 2: Investigasi Lapangan</h3>
              <p className="text-sm text-slate-400">Pengecekan fisik dan uji bypass oleh Tim EOS</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="glass-card rounded-xl p-5 border-l-4 border-amber-500/50 bg-slate-800/30">
              <Label className="text-white text-lg mb-2 flex items-center gap-2">
                 <span className="text-amber-400">📅</span> Waktu Tiba di Lokasi
              </Label>
              <p className="text-xs text-slate-400 mb-4 italic">
                *Sesuaikan jam ini dengan waktu kedatangan Anda di lapangan.
              </p>
              <Input
                type="datetime-local"
                value={phase2.arrival_time}
                onChange={(e) => setPhase2({...phase2, arrival_time: e.target.value})}
                className="input-dark h-12 text-white scheme-dark"
                data-testid="arrival-time"
              />
              <p className="text-xs text-amber-500/80 mt-2 font-medium">Target SLG: Max 4 jam sejak Open Ticket</p>
            </div>

            {ticket.service_type === 'cctv' && (
              <>
                <div>
                  <Label className="text-slate-300">Pengecekan Kelistrikan PJU/MCB *</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {['Normal', 'Padam/MCB Turun'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPhase2({...phase2, electricity_check: opt})}
                        className={`p-3 rounded-lg border-2 text-sm ${
                          phase2.electricity_check === opt
                            ? 'border-rose-500 bg-rose-500/10 text-white'
                            : 'border-slate-700 text-slate-400'
                        }`}
                        data-testid={`electricity-${opt}`}
                      >
                        <Zap className={`w-5 h-5 mx-auto mb-1 ${phase2.electricity_check === opt ? 'text-amber-400' : ''}`} />
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Indikator Modem/ONT *</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {['Normal (PON Nyala)', 'LOS Merah / Mati'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPhase2({...phase2, modem_indicator: opt})}
                        className={`p-3 rounded-lg border-2 text-sm ${
                          phase2.modem_indicator === opt
                            ? 'border-rose-500 bg-rose-500/10 text-white'
                            : 'border-slate-700 text-slate-400'
                        }`}
                        data-testid={`modem-${opt}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(ticket.service_type === 'skpd' || ticket.service_type === 'ip_speaker') && (
              <div className="space-y-4">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-cyan-400" />
                  Hasil Uji Bypass (Speedtest) *
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-slate-500">Download (Mbps)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={phase2.bypass_download}
                      onChange={(e) => setPhase2({...phase2, bypass_download: e.target.value})}
                      className="input-dark h-11 text-white"
                      placeholder={`Target: ${ticket.bandwidth}`}
                      data-testid="bypass-download"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Upload (Mbps)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={phase2.bypass_upload}
                      onChange={(e) => setPhase2({...phase2, bypass_upload: e.target.value})}
                      className="input-dark h-11 text-white"
                      data-testid="bypass-upload"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Ping (ms)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={phase2.bypass_ping}
                      onChange={(e) => setPhase2({...phase2, bypass_ping: e.target.value})}
                      className="input-dark h-11 text-white"
                      data-testid="bypass-ping"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Bandwidth kontrak: {ticket.bandwidth} Mbps - Lampirkan screenshot speedtest
                </p>
              </div>
            )}

            <PhotoUpload 
              photos={phase2.photos}
              onUpload={(e) => handlePhotoUpload(phase2, setPhase2, e)}
              onRemove={(i) => removePhoto(phase2, setPhase2, i)}
              label="Upload Foto Hasil Pengecekan *"
              isUploading={isUploadingPhoto}
            />
          </div>

          <Button
            onClick={() => savePhase(2)}
            disabled={submitting || isUploadingPhoto}
            className="w-full h-12 btn-primary"
            data-testid="save-phase2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan & Lanjut ke Tahap 3'}
          </Button>
        </div>
      )}

      {currentPhase === 1 && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Tahap 3: Klasifikasi Gangguan</h3>
              <p className="text-sm text-slate-400">Tentukan klasifikasi berdasarkan hasil investigasi</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setPhase3({...phase3, scenario: 'A'})}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                phase3.scenario === 'A'
                  ? 'border-rose-500 bg-rose-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
              data-testid="scenario-a"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                  <Server className="w-4 h-4 text-rose-400" />
                </div>
                <span className="text-white font-medium">Gangguan Jaringan Telkom</span>
              </div>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Modem/ONT LOS atau mati</li>
                <li>• Bypass test RTO/tidak sesuai kontrak</li>
                <li>• Kabel fiber optik putus</li>
              </ul>
              <p className="text-xs text-rose-400 mt-3 font-semibold">⚠️ SLA Restitusi DIHITUNG</p>
            </button>

            <button
              type="button"
              onClick={() => setPhase3({...phase3, scenario: 'B'})}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                phase3.scenario === 'B'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
              data-testid="scenario-b"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-white font-medium">Gangguan Sisi Pengguna / Force Majeure</span>
              </div>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Bypass test normal sesuai kontrak</li>
                <li>• Listrik PJU padam/MCB turun</li>
                <li>• Perangkat SKPD/Kamera rusak</li>
              </ul>
              <p className="text-xs text-emerald-400 mt-3 font-semibold">✓ SLA Restitusi TIDAK DIHITUNG</p>
            </button>
          </div>

          <div>
            <Label className="text-slate-300">Detail Alasan Klasifikasi *</Label>
            <Textarea
              value={phase3.scenario_detail}
              onChange={(e) => setPhase3({...phase3, scenario_detail: e.target.value})}
              className="input-dark min-h-[100px] text-white"
              placeholder="Jelaskan temuan di lapangan yang mendukung klasifikasi gangguan..."
              data-testid="scenario-detail"
            />
          </div>

          <PhotoUpload 
            photos={phase3.photos}
            onUpload={(e) => handlePhotoUpload(phase3, setPhase3, e)}
            onRemove={(i) => removePhoto(phase3, setPhase3, i)}
            label="Upload Foto Bukti Klasifikasi"
            isUploading={isUploadingPhoto}
          />

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCurrentPhase(0)} className="flex-1 border-slate-700">
              Kembali
            </Button>
            <Button
              onClick={() => savePhase(3)}
              disabled={submitting || isUploadingPhoto || !phase3.scenario}
              className="flex-1 h-12 btn-primary"
              data-testid="save-phase3"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan & Lanjut'}
            </Button>
          </div>
        </div>
      )}

      {currentPhase === 2 && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <FileText className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Tahap 4: Tindakan Perbaikan</h3>
              <p className="text-sm text-slate-400">Catat tindakan teknis yang dilakukan</p>
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Tindakan yang Dilakukan *</Label>
            <Textarea
              value={phase4.action_taken}
              onChange={(e) => setPhase4({...phase4, action_taken: e.target.value})}
              className="input-dark min-h-[120px] text-white"
              placeholder="Contoh: Restart modem, re-config, penggantian ONT, splicing kabel, dll..."
              data-testid="action-taken"
            />
          </div>

          {phase3.scenario === 'A' && (
            <div>
              <Label className="text-slate-300">Kategori Gangguan (untuk SLA)</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setPhase4({...phase4, category: 'Kategori 1'})}
                  className={`p-3 rounded-lg border-2 text-sm ${
                    phase4.category === 'Kategori 1'
                      ? 'border-rose-500 bg-rose-500/10 text-white'
                      : 'border-slate-700 text-slate-400'
                  }`}
                  data-testid="category-1"
                >
                  <p className="font-medium">Kategori 1</p>
                  <p className="text-xs mt-1">SLA Dihitung (Modem rusak, config error)</p>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase4({...phase4, category: 'Kategori 2'})}
                  className={`p-3 rounded-lg border-2 text-sm ${
                    phase4.category === 'Kategori 2'
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-700 text-slate-400'
                  }`}
                  data-testid="category-2"
                >
                  <p className="font-medium">Kategori 2</p>
                  <p className="text-xs mt-1">Pengecualian SLA (Force majeure, vandalisme)</p>
                </button>
              </div>
            </div>
          )}

          <PhotoUpload 
            photos={phase4.photos}
            onUpload={(e) => handlePhotoUpload(phase4, setPhase4, e)}
            onRemove={(i) => removePhoto(phase4, setPhase4, i)}
            label="Upload Foto Proses Perbaikan *"
            isUploading={isUploadingPhoto}
          />

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCurrentPhase(1)} className="flex-1 border-slate-700">
              Kembali
            </Button>
            <Button
              onClick={() => savePhase(4)}
              disabled={submitting || isUploadingPhoto || !phase4.action_taken}
              className="flex-1 h-12 btn-primary"
              data-testid="save-phase4"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan & Lanjut'}
            </Button>
          </div>
        </div>
      )}

      {currentPhase === 3 && (
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-lg font-semibold text-white">Tahap 5: Penyelesaian</h3>
              <p className="text-sm text-slate-400">Status akhir layanan dan waktu selesai</p>
            </div>
          </div>

          <div className="glass-card rounded-xl p-5 border-l-4 border-amber-500/50 bg-slate-800/30">
            <Label className="text-white text-lg mb-2 flex items-center gap-2">
               <span className="text-amber-400">📅</span> Waktu Selesai Penanganan (Backdate)
            </Label>
            <p className="text-xs text-slate-400 mb-4 italic">
              *Sangat penting untuk perhitungan SLA Restitusi. Pastikan jam ini akurat.
            </p>
            <Input
              type="datetime-local"
              value={phase5.completion_time}
              onChange={(e) => setPhase5({...phase5, completion_time: e.target.value})}
              className="input-dark h-12 text-white scheme-dark"
              data-testid="completion-time"
            />
            <p className="text-xs text-amber-500/80 mt-2 font-medium">Target SLG Recovery: Max 3 jam sejak tiba di lokasi</p>
          </div>

          <div>
            <Label className="text-slate-300">Status Akhir Layanan *</Label>
            <div className="space-y-3 mt-2">
              {[
                { value: 'normal_user', label: 'Normal di Sisi Pengguna', desc: 'Layanan berfungsi normal, keluhan teratasi tuntas', color: 'emerald' },
                { value: 'normal_telkom_pending', label: 'Normal Sisi Telkom (Pending Kominfo)', desc: 'Jaringan Telkom normal, menunggu perbaikan perangkat SKPD/kamera', color: 'amber' },
                { value: 'escalation_core', label: 'Eskalasi Tim Core', desc: 'Perlu perbaikan oleh Tim Core/Splicer Telkom', color: 'rose' }
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPhase5({...phase5, final_status: opt.value})}
                  className={`w-full p-4 rounded-lg border-2 text-left ${
                    phase5.final_status === opt.value
                      ? `border-${opt.color}-500 bg-${opt.color}-500/10`
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                  data-testid={`status-${opt.value}`}
                >
                  <p className={`font-medium ${phase5.final_status === opt.value ? 'text-white' : 'text-slate-300'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {phase2.arrival_time && phase5.completion_time && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-white mb-3">Evaluasi Waktu SLG:</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Response Time</p>
                  <p className="text-white font-mono">{calculateTimes().responseMinutes} menit</p>
                  <p className="text-xs text-slate-500">Target: &lt;240 menit</p>
                </div>
                <div>
                  <p className="text-slate-400">Recovery Time</p>
                  <p className="text-white font-mono">{calculateTimes().recoveryMinutes} menit</p>
                  <p className="text-xs text-slate-500">Target: &lt;180 menit</p>
                </div>
                <div>
                  <p className="text-slate-400">Total Downtime</p>
                  <p className={`font-mono ${phase3.scenario === 'A' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {calculateTimes().totalDowntime} menit
                  </p>
                  <p className="text-xs text-slate-500">{phase3.scenario === 'A' ? 'Dihitung SLA' : 'Pengecualian SLA'}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label className="text-slate-300">Catatan Tambahan</Label>
            <Textarea
              value={phase5.notes}
              onChange={(e) => setPhase5({...phase5, notes: e.target.value})}
              className="input-dark min-h-[80px] text-white"
              placeholder="Catatan tambahan jika diperlukan..."
              data-testid="notes"
            />
          </div>

          <PhotoUpload 
            photos={phase5.photos}
            onUpload={(e) => handlePhotoUpload(phase5, setPhase5, e)}
            onRemove={(i) => removePhoto(phase5, setPhase5, i)}
            label="Upload Foto Hasil Akhir (Layanan Online) *"
            isUploading={isUploadingPhoto}
          />

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCurrentPhase(2)} className="flex-1 border-slate-700">
              Kembali
            </Button>
            <Button
              onClick={() => savePhase(5)}
              disabled={submitting || isUploadingPhoto || !phase5.final_status}
              className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700"
              data-testid="complete-logbook"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Selesai & Tutup Logbook
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const PhotoUpload = ({ photos, onUpload, onRemove, label, isUploading }) => (
  <div className="space-y-3">
    <Label className="text-slate-300">{label}</Label>
    <label className={`file-input-label flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-colors ${
      isUploading ? 'border-slate-600 bg-slate-800/50 cursor-not-allowed' : 'border-slate-700 hover:border-rose-500 cursor-pointer'
    }`}>
      {isUploading ? (
        <>
          <Loader2 className="w-8 h-8 text-rose-500 mb-2 animate-spin" />
          <span className="text-sm text-slate-400">Mengunggah file ke server...</span>
        </>
      ) : (
        <>
          <Upload className="w-8 h-8 text-slate-500 mb-1" />
          <span className="text-sm text-slate-400">Klik untuk upload foto</span>
          <span className="text-xs text-slate-500">PNG, JPG hingga 5MB</span>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={onUpload}
        disabled={isUploading}
        className="hidden"
      />
    </label>
    {photos && photos.length > 0 && (
      <div className="grid grid-cols-4 gap-2">
        {photos.map((photo, index) => (
          <div key={index} className="relative group">
            <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-20 object-cover rounded-lg" />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default LogbookPage;