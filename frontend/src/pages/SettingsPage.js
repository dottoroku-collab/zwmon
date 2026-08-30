import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  Settings, Save, Loader2, MessageSquare, DollarSign, Camera, Server, Megaphone, Image, Type, Database, Archive, Download, Upload
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const SettingsPage = () => {
  const { api, setSiteSettings } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // State untuk loading backup/restore
  const [exportingDb, setExportingDb] = useState(false);
  const [importingDb, setImportingDb] = useState(false);
  const [exportingFull, setExportingFull] = useState(false);
  const [importingFull, setImportingFull] = useState(false);

  // Reference untuk input file tersembunyi
  const dbFileInputRef = useRef(null);
  const fullFileInputRef = useRef(null);

  const [settings, setSettings] = useState({
    telegram_token: '',
    telegram_chat_ids: '',
    contract_cctv: '',
    contract_skpd: '',
    contract_ip_speaker: '',
    site_name: '',
    site_logo: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.getSettings();
      const data = response.data.settings || {};
      setSettings({
        telegram_token: data.telegram_token || '',
        telegram_chat_ids: data.telegram_chat_ids || '',
        contract_cctv: data.contract_cctv || '500000000',
        contract_skpd: data.contract_skpd || '800000000',
        contract_ip_speaker: data.contract_ip_speaker || '200000000',
        site_name: data.site_name || 'Sistem Tiketing & SLA Control Telkom Makassar',
        site_logo: data.site_logo || ''
      });
    } catch (error) {
      toast.error('Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleSave = async (key) => {
    setSaving(true);
    try {
      await api.updateSettings(key, settings[key]);
      toast.success('Pengaturan berhasil disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const keys = Object.keys(settings);
      for (const key of keys) {
        if (key === 'site_logo' && !settings[key]) continue;
        await api.updateSettings(key, settings[key]);
      }
      setSiteSettings({ site_name: settings.site_name, site_logo: settings.site_logo });
      toast.success('Semua pengaturan berhasil disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran logo maksimal 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setSettings(prev => ({ ...prev, site_logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const formatCurrency = (value) => {
    if (!value) return '';
    return new Intl.NumberFormat('id-ID').format(value);
  };

  // ================= FUNGSI BACKUP/RESTORE DB (JSON) =================
  const handleExportDb = async () => {
    setExportingDb(true);
    try {
      const response = await api.get('/settings/backup');
      const data = response.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ZWMON_DB_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Database berhasil diekspor');
    } catch (error) {
      toast.error('Gagal mengekspor database');
    } finally {
      setExportingDb(false);
    }
  };

  const handleImportDbClick = () => {
    if (window.confirm('PERINGATAN: Impor database akan menimpa data teks yang ada. Lanjutkan?')) {
      dbFileInputRef.current?.click();
    }
  };

  const handleImportDb = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      toast.error('Format file harus JSON'); return;
    }

    setImportingDb(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/settings/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Database berhasil diimpor. Halaman akan dimuat ulang...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      toast.error('Gagal mengimpor database');
    } finally {
      setImportingDb(false);
      if (dbFileInputRef.current) dbFileInputRef.current.value = '';
    }
  };

  // ================= FUNGSI BACKUP/RESTORE FULL (ZIP) =================
  const handleExportFull = async () => {
    setExportingFull(true);
    try {
      // PENTING: Pastikan fungsi api.get di AppContext menerima dan meneruskan parameter 'responseType' ke Axios
      const response = await api.get('/settings/backup/full', { responseType: 'blob' });
      
      // Jaga-jaga kalau wrapper 'api' langsung me-return response.data
      const blobData = response.data ? response.data : response;
      const url = window.URL.createObjectURL(new Blob([blobData]));
      
      const a = document.createElement('a');
      a.href = url;

      // Coba tangkap nama file persis dari backend (yang ada jam dan menitnya)
      let fileName = `ZWMON_FULL_${new Date().toISOString().split('T')[0]}.zip`;
      if (response.headers && response.headers['content-disposition']) {
          const disposition = response.headers['content-disposition'];
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) {
              fileName = match[1];
          }
      }

      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Bersihkan memory browser
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Backup Full berhasil diunduh');
    } catch (error) {
      console.error("Error Download ZIP:", error); // Biar gampang kita inspect kalau masih error
      toast.error('Gagal melakukan backup full. Pastikan server merespon dengan benar.');
    } finally {
      setExportingFull(false);
    }
  };

  const handleImportFullClick = () => {
    if (window.confirm('PERINGATAN KERAS: Impor Full akan menimpa SELURUH database dan foto logbook. Pastikan file ZIP valid. Lanjutkan?')) {
      fullFileInputRef.current?.click();
    }
  };

  const handleImportFull = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.zip') && file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      toast.error('Format file harus ZIP'); return;
    }

    setImportingFull(true);
    toast.info('Sedang memulihkan sistem (Database + Foto). Mohon tunggu...', { duration: 5000 });
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/settings/restore/full', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Sistem berhasil dipulihkan seutuhnya! Halaman akan dimuat ulang...');
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      toast.error('Gagal memulihkan sistem. File mungkin rusak atau terlalu besar.');
    } finally {
      setImportingFull(false);
      if (fullFileInputRef.current) fullFileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pengaturan</h1>
          <p className="text-slate-400">Kelola konfigurasi sistem</p>
        </div>
        <Button onClick={handleSaveAll} disabled={saving} className="btn-primary" data-testid="save-all-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Simpan Semua
        </Button>
      </div>

      {/* --- MENU BARU: BACKUP & RESTORE --- */}
      <div className="glass-card rounded-xl p-6 space-y-6 border border-indigo-500/30">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Manajemen Data & Backup</h2>
            <p className="text-sm text-slate-400">Amankan data tiket dan foto logbook ke penyimpanan lokal</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Opsi 1: Database Saja */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-3">
                <div className="p-2 bg-slate-800 rounded-lg"><Database className="w-5 h-5 text-emerald-400"/></div>
                <div>
                  <h3 className="text-slate-200 font-medium">Backup Database Saja (JSON)</h3>
                  <p className="text-xs text-slate-400 mt-1">Hanya menyimpan data teks (User, Tiket, Titik Layanan). Proses cepat, ukuran file kecil.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleExportDb} disabled={exportingDb} variant="outline" className="flex-1 bg-slate-800/50 hover:bg-emerald-500/10 hover:text-emerald-400 border-slate-600">
                {exportingDb ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Ekspor JSON
              </Button>
              <input type="file" accept=".json" className="hidden" ref={dbFileInputRef} onChange={handleImportDb} />
              <Button onClick={handleImportDbClick} disabled={importingDb} variant="outline" className="flex-1 bg-slate-800/50 hover:bg-rose-500/10 hover:text-rose-400 border-slate-600">
                {importingDb ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Impor JSON
              </Button>
            </div>
          </div>

          {/* Opsi 2: Full System */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-3">
                <div className="p-2 bg-slate-800 rounded-lg"><Archive className="w-5 h-5 text-amber-400"/></div>
                <div>
                  <h3 className="text-slate-200 font-medium">Full Backup (Database + Foto Logbook)</h3>
                  <p className="text-xs text-slate-400 mt-1">Menyimpan database beserta <b>seluruh file gambar/foto</b> dalam format ZIP. Proses lebih lama tergantung ukuran foto.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={handleExportFull} disabled={exportingFull} className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/50">
                {exportingFull ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Download ZIP
              </Button>
              <input type="file" accept=".zip" className="hidden" ref={fullFileInputRef} onChange={handleImportFull} />
              <Button onClick={handleImportFullClick} disabled={importingFull} className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/50">
                {importingFull ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Restore ZIP
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* --- AKHIR MENU BARU --- */}

      {/* Site Settings */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
            <Type className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Identitas Website</h2>
            <p className="text-sm text-slate-400">Logo dan nama website</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Nama Website</Label>
            <Input
              name="site_name"
              value={settings.site_name}
              onChange={handleChange}
              className="input-dark h-11 text-white"
              placeholder="Nama website"
              data-testid="site-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Logo Website</Label>
            <div className="flex items-center gap-4">
              {settings.site_logo ? (
                <img src={settings.site_logo} alt="Logo" className="w-16 h-16 rounded-lg object-cover border border-slate-700" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                  <Image className="w-6 h-6 text-slate-500" />
                </div>
              )}
              <div>
                <label className="cursor-pointer">
                  <span className="px-4 py-2 rounded-lg bg-slate-800 text-sm text-slate-300 hover:bg-slate-700 transition-colors inline-block">
                    Upload Logo
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} data-testid="logo-upload-input" />
                </label>
                <p className="text-xs text-slate-500 mt-1">Maks 2MB. PNG atau JPG</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Settings */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Notifikasi Telegram</h2>
            <p className="text-sm text-slate-400">Konfigurasi bot Telegram untuk notifikasi</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Bot Token</Label>
            <Input
              name="telegram_token"
              value={settings.telegram_token}
              onChange={handleChange}
              className="input-dark h-11 text-white mono"
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              data-testid="telegram-token"
            />
            <p className="text-xs text-slate-500">
              Dapatkan token dari @BotFather di Telegram
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Chat IDs (pisahkan dengan koma)</Label>
            <Input
              name="telegram_chat_ids"
              value={settings.telegram_chat_ids}
              onChange={handleChange}
              className="input-dark h-11 text-white mono"
              placeholder="-1001234567890, 123456789"
              data-testid="telegram-chat-ids"
            />
            <p className="text-xs text-slate-500">
              ID chat atau group yang akan menerima notifikasi
            </p>
          </div>
        </div>
      </div>

      {/* Contract Values */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Dasar Perhitungan Restitusi (Nilai B)</h2>
            <p className="text-sm text-slate-400">Masukkan nilai tagihan sesuai model kontrak layanan</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* CCTV */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-slate-400" />
              <Label className="text-slate-300">Jaringan CCTV <span className="text-amber-400 text-xs ml-2">(Sistem Satuan)</span></Label>
            </div>
            <p className="text-xs text-slate-400 mb-2">Masukkan nilai kontrak untuk <b>1 TITIK</b> dalam sebulan (sebelum PPN).</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">Rp</span>
              <Input
                name="contract_cctv"
                value={settings.contract_cctv}
                onChange={handleChange}
                className="input-dark h-11 text-white pl-10 mono"
                placeholder="500000000"
                type="number"
                data-testid="contract-cctv"
              />
            </div>
            <p className="text-xs text-slate-500">
              Nilai saat ini: Rp {formatCurrency(settings.contract_cctv)}
            </p>
          </div>

          {/* SKPD */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-400" />
              <Label className="text-slate-300">Internet Dedicated SKPD <span className="text-rose-400 text-xs ml-2">(Sistem Bulky)</span></Label>
            </div>
            <p className="text-xs text-slate-400 mb-2">Masukkan <b>TOTAL</b> nilai kontrak seluruh bandwidth SKPD dalam sebulan (sebelum PPN).</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">Rp</span>
              <Input
                name="contract_skpd"
                value={settings.contract_skpd}
                onChange={handleChange}
                className="input-dark h-11 text-white pl-10 mono"
                placeholder="800000000"
                type="number"
                data-testid="contract-skpd"
              />
            </div>
            <p className="text-xs text-slate-500">
              Nilai saat ini: Rp {formatCurrency(settings.contract_skpd)}
            </p>
          </div>

          {/* IP Speaker */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-slate-400" />
              <Label className="text-slate-300">IP Speaker <span className="text-amber-400 text-xs ml-2">(Sistem Satuan)</span></Label>
            </div>
            <p className="text-xs text-slate-400 mb-2">Masukkan nilai kontrak untuk <b>1 TITIK</b> dalam sebulan (sebelum PPN).</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">Rp</span>
              <Input
                name="contract_ip_speaker"
                value={settings.contract_ip_speaker}
                onChange={handleChange}
                className="input-dark h-11 text-white pl-10 mono"
                placeholder="200000000"
                type="number"
                data-testid="contract-ip-speaker"
              />
            </div>
            <p className="text-xs text-slate-500">
              Nilai saat ini: Rp {formatCurrency(settings.contract_ip_speaker)}
            </p>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="glass-card rounded-xl p-6 border-l-4 border-cyan-500">
        <h3 className="text-white font-medium mb-2">Informasi SLA</h3>
        <ul className="text-sm text-slate-400 space-y-1">
          <li>- Target SLA: 99.5% uptime per bulan</li>
          <li>- Maksimal downtime yang diizinkan: ~3.6 jam/bulan</li>
          <li>- Penalty rate untuk downtime berlebih: 150%</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPage;