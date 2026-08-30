import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { User, Phone, Mail, Shield, Save, Loader2, Camera, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const roleLabels = {
  admin: 'Administrator', am: 'Account Manager', helpdesk: 'Helpdesk',
  eos: 'EOS (Enterprise Operation Service)', client: 'Client'
};

const ProfilePage = () => {
  const { user, api, setUser } = useApp();
  const [form, setForm] = useState({ full_name: '', phone: '', photo: '' });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.getMe();
        setForm({ full_name: res.data.full_name || '', phone: res.data.phone || '', photo: res.data.photo || '' });
      } catch { toast.error('Gagal memuat profil'); }
      finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Ukuran foto maksimal 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(prev => ({ ...prev, photo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.updateProfile(form);
      toast.success('Profil berhasil diupdate');
      if (res.data.user) setUser(prev => ({ ...prev, ...res.data.user }));
    } catch (error) { toast.error(error.response?.data?.detail || 'Gagal menyimpan profil'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm_password) {
      toast.error('Password baru tidak cocok');
      return;
    }
    if (pwForm.new_password.length < 6) {
      toast.error('Password baru minimal 6 karakter');
      return;
    }
    setChangingPw(true);
    try {
      await api.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Password berhasil diubah');
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error) { toast.error(error.response?.data?.detail || 'Gagal mengubah password'); }
    finally { setChangingPw(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in" data-testid="profile-page">
      <h1 className="text-2xl font-bold text-white">Profil Saya</h1>

      {/* Profile Info */}
      <div className="glass-card rounded-xl p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-slate-800 overflow-hidden flex items-center justify-center border-2 border-slate-700">
              {form.photo ? <img src={form.photo} alt="Profile" className="w-full h-full object-cover" /> : <User className="w-10 h-10 text-slate-500" />}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 bg-rose-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-rose-600 transition-colors" data-testid="photo-upload-btn">
              <Camera className="w-4 h-4 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Email</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <Mail className="w-4 h-4 text-slate-500" /><span className="text-slate-300" data-testid="profile-email">{user?.email}</span>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Role</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <Shield className="w-4 h-4 text-slate-500" /><span className="text-slate-300">{roleLabels[user?.role] || user?.role}</span>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Nama Lengkap</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input value={form.full_name} onChange={(e) => setForm(prev => ({ ...prev, full_name: e.target.value }))} className="input-dark pl-10 h-12 text-white" placeholder="Masukkan nama lengkap" data-testid="profile-name-input" />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Nomor Telepon</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input value={form.phone} onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))} className="input-dark pl-10 h-12 text-white" placeholder="08123456789" data-testid="profile-phone-input" />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full btn-primary h-12" data-testid="save-profile-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Simpan Perubahan</>}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card rounded-xl p-8" data-testid="change-password-section">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">Ubah Password</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-2">Password Lama</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input type={showCurrentPw ? 'text' : 'password'} value={pwForm.current_password} onChange={(e) => setPwForm(prev => ({ ...prev, current_password: e.target.value }))} className="input-dark pl-10 pr-10 h-12 text-white" placeholder="Password lama" data-testid="current-password-input" />
              <button onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input type={showNewPw ? 'text' : 'password'} value={pwForm.new_password} onChange={(e) => setPwForm(prev => ({ ...prev, new_password: e.target.value }))} className="input-dark pl-10 pr-10 h-12 text-white" placeholder="Password baru (min 6 karakter)" data-testid="new-password-input" />
              <button onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Konfirmasi Password Baru</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input type="password" value={pwForm.confirm_password} onChange={(e) => setPwForm(prev => ({ ...prev, confirm_password: e.target.value }))} className="input-dark pl-10 h-12 text-white" placeholder="Ulangi password baru" data-testid="confirm-password-input" />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={changingPw || !pwForm.current_password || !pwForm.new_password} className="w-full bg-amber-600 hover:bg-amber-700 h-12" data-testid="change-password-btn">
            {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" />Ubah Password</>}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
