import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Ticket, Eye, EyeOff, Loader2 } from 'lucide-react';

const AuthPage = () => {
  const { login, api } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [seeding, setSeeding] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });


  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(formData.email, formData.password);
      toast.success('Login berhasil!');
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.detail || 'Terjadi kesalahan';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-12 bg-slate-950">
        <div className="max-w-md w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center p-2 shadow-lg animate-pulse-glow">
              <img src="/logo.png" alt="ZWMON Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">ZWMON</h1>
              <p className="text-sm text-slate-400">Zero-Downtime & Wide-Area Monitoring</p>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl font-bold text-white mb-2">
            Masuk ke Akun
          </h2>
          <p className="text-slate-400 mb-8">
            Masuk untuk mengakses sistem tiketing
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="input-dark h-12 text-white"
                placeholder="nama@email.com"
                required
                data-testid="auth-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="input-dark h-12 text-white pr-12"
                  placeholder="Masukkan password"
                  required
                  data-testid="auth-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || seeding}
              className="w-full h-12 btn-primary text-white font-semibold uppercase tracking-wider"
              data-testid="auth-submit-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : 'Masuk'}
            </Button>
          </form>
        </div>
      </div>

      {/* Right Side - Image */}
      <div 
        className="hidden lg:block lg:w-1/2 bg-cover bg-center relative"
        style={{ 
          backgroundImage: `url('https://images.pexels.com/photos/4597280/pexels-photo-4597280.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')` 
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-900/60" />
        <div className="absolute inset-0 flex items-end p-12">
          <div className="max-w-lg">
            <h3 className="text-3xl font-bold text-white mb-4">
              Sistem Monitoring SLA Terpadu
            </h3>
            <p className="text-slate-300 text-lg">
              Pantau dan kelola layanan CCTV, Internet SKPD, dan IP Speaker untuk 
              PT Telkom Makassar Reg V Witel Sulbagsel & Dinas Kominfo Kota Makassar dengan efisien.
            </p>
            <div className="flex gap-4 mt-8">
              <div className="glass-card rounded-lg px-4 py-3">
                <p className="text-2xl font-bold text-rose-400">4900</p>
                <p className="text-xs text-slate-400">Mbps CCTV</p>
              </div>
              <div className="glass-card rounded-lg px-4 py-3">
                <p className="text-2xl font-bold text-cyan-400">5500</p>
                <p className="text-xs text-slate-400">Mbps SKPD</p>
              </div>
              <div className="glass-card rounded-lg px-4 py-3">
                <p className="text-2xl font-bold text-emerald-400">500</p>
                <p className="text-xs text-slate-400">Mbps IP Speaker</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;