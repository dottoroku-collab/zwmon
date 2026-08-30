import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  Calculator, 
  Camera,
  Server,
  Megaphone,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info,
  Clock
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

const serviceOptions = [
  { value: 'cctv', label: 'Jaringan CCTV', icon: Camera, totalBw: 4900, type: 'satuan', bwPerPoint: 10 },
  { value: 'skpd', label: 'Internet Dedicated SKPD', icon: Server, totalBw: 5500, type: 'bulky' },
  { value: 'ip_speaker', label: 'IP Speaker', icon: Megaphone, totalBw: 500, type: 'satuan', bwPerPoint: 5 },
];

const months = [
  { value: 1, label: 'Januari', days: 31 },
  { value: 2, label: 'Februari', days: 28 },
  { value: 3, label: 'Maret', days: 31 },
  { value: 4, label: 'April', days: 30 },
  { value: 5, label: 'Mei', days: 31 },
  { value: 6, label: 'Juni', days: 30 },
  { value: 7, label: 'Juli', days: 31 },
  { value: 8, label: 'Agustus', days: 31 },
  { value: 9, label: 'September', days: 30 },
  { value: 10, label: 'Oktober', days: 31 },
  { value: 11, label: 'November', days: 30 },
  { value: 12, label: 'Desember', days: 31 },
];

const RestitutionPage = () => {
  const { api } = useApp();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [servicePoints, setServicePoints] = useState([]);
  const [formData, setFormData] = useState({
    service_type: '',
    service_point_id: '',
    bandwidth_affected: '',
    downtime_hours: '',
    downtime_minutes: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    if (formData.service_type) {
      fetchServicePoints();
    }
  }, [formData.service_type]);

  const fetchServicePoints = async () => {
    try {
      const response = await api.getServicePoints({ service_type: formData.service_type });
      setServicePoints(response.data.points || []);
    } catch (error) {
      console.error('Failed to fetch service points');
    }
  };

  const handleChange = (name, value) => {
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      if (name === 'service_point_id' && value) {
        const point = servicePoints.find(p => p.id === value);
        if (point) {
          updated.bandwidth_affected = point.bandwidth.toString();
        }
      }
      
      return updated;
    });
  };

  const calculateTotalMinutes = () => {
    const hours = parseInt(formData.downtime_hours) || 0;
    const minutes = parseInt(formData.downtime_minutes) || 0;
    return (hours * 60) + minutes;
  };

  const handleCalculate = async () => {
    if (!formData.service_type || !formData.bandwidth_affected) {
      toast.error('Mohon lengkapi semua field');
      return;
    }

    const totalMinutes = calculateTotalMinutes();
    if (totalMinutes <= 0) {
      toast.error('Masukkan durasi downtime yang valid');
      return;
    }

    setLoading(true);
    try {
      const response = await api.calculateRestitution({
        service_type: formData.service_type,
        service_point_id: formData.service_point_id,
        bandwidth_affected: parseFloat(formData.bandwidth_affected),
        downtime_minutes: totalMinutes,
        month: parseInt(formData.month),
        year: parseInt(formData.year)
      });

      // CARI NAMA TITIK LAYANAN UNTUK DITAMPILKAN
      const point = servicePoints.find(p => p.id === formData.service_point_id);
      
      // SIMPAN NAMA TITIK KE DALAM RESULT SUPAYA PATEN
      setResult({
        ...response.data,
        point_name: point ? point.name : ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menghitung restitusi');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} Jam ${mins} Menit`;
  };

  const selectedService = serviceOptions.find(s => s.value === formData.service_type);
  const ServiceIcon = selectedService?.icon || Calculator;

  const isBulky = result?.service_type === 'skpd';
  const resultServiceDef = serviceOptions.find(s => s.value === result?.service_type);
  
  // ---> INI TAMBAHANNYA BOSKA: Mengambil nama titik layanan yang dipilih
  const selectedPoint = servicePoints.find(p => p.id === formData.service_point_id);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Kalkulator Restitusi SLA</h1>
        <p className="text-slate-400">Hitung estimasi penalti berdasarkan SOP dengan rumus resmi</p>
      </div>

      {/* Formula Info */}
      <div className="glass-card rounded-xl p-4 border-l-4 border-cyan-500">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-cyan-400 mt-0.5" />
          <div>
            <h3 className="text-white font-medium mb-2">Rumus Restitusi SOP</h3>
            <code className="text-cyan-400 bg-slate-800 px-2 py-1 rounded text-sm">
              Restitusi = ((A - Av) / C) × B
            </code>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
              <div>
                <span className="text-slate-400">C =</span>
                <span className="text-white ml-1">Total menit/bulan</span>
              </div>
              <div>
                <span className="text-slate-400">Av =</span>
                <span className="text-white ml-1">0.5% × C (toleransi)</span>
              </div>
              <div>
                <span className="text-slate-400">A =</span>
                <span className="text-white ml-1">Total downtime (menit)</span>
              </div>
              <div>
                <span className="text-slate-400">B =</span>
                <span className="text-white ml-1">Nilai Dasar Restitusi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calculator Form */}
        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-rose-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Input Perhitungan</h2>
          </div>

          <div className="space-y-5">
            {/* Service Type */}
            <div className="space-y-2">
              <Label className="text-slate-300">Jenis Layanan *</Label>
              <Select value={formData.service_type || undefined} onValueChange={(v) => handleChange('service_type', v)}>
                <SelectTrigger className="input-dark h-12" data-testid="select-service">
                  <SelectValue placeholder="Pilih layanan" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {serviceOptions.map((service) => {
                    const Icon = service.icon;
                    return (
                      <SelectItem key={service.value} value={service.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{service.label}</span>
                          <span className={`text-xs ${service.type === 'bulky' ? 'text-rose-400' : 'text-amber-400'}`}>
                            ({service.type === 'bulky' ? 'Bulky' : 'Satuan'})
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Service Point (Optional) */}
            {formData.service_type && servicePoints.length > 0 && (
              <div className="space-y-2">
                <Label className="text-slate-300">Titik Layanan (Opsional)</Label>
                <Select value={formData.service_point_id || "manual"} onValueChange={(v) => handleChange('service_point_id', v === "manual" ? "" : v)}>
                  <SelectTrigger className="input-dark h-12" data-testid="select-point">
                    <SelectValue placeholder="Pilih titik (auto-fill bandwidth)" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="manual">Input Manual</SelectItem>
                    {servicePoints.map((point) => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.name} - {point.bandwidth} Mbps
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Bandwidth Affected */}
            <div className="space-y-2">
              <Label className="text-slate-300">Bandwidth Terganggu (Mbps) *</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={formData.bandwidth_affected}
                onChange={(e) => handleChange('bandwidth_affected', e.target.value)}
                className="input-dark h-12 text-white"
                placeholder={selectedService?.type === 'satuan' ? `${selectedService.bwPerPoint} (standar per titik)` : 'Masukkan bandwidth'}
                data-testid="input-bandwidth"
              />
              {selectedService && (
                <p className="text-xs text-slate-500">
                  {selectedService.type === 'bulky' 
                    ? `Total bandwidth kontrak bulky: ${selectedService.totalBw} Mbps` 
                    : `Standar bandwidth untuk 1 titik: ${selectedService.bwPerPoint} Mbps`}
                </p>
              )}
            </div>

            {/* Downtime in Minutes */}
            <div className="space-y-2">
              <Label className="text-slate-300">Total Downtime (Gangguan Jaringan Telkom) *</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Input
                    type="number"
                    min="0"
                    value={formData.downtime_hours}
                    onChange={(e) => handleChange('downtime_hours', e.target.value)}
                    className="input-dark h-12 text-white"
                    placeholder="Jam"
                    data-testid="input-hours"
                  />
                  <p className="text-xs text-slate-500 mt-1">Jam</p>
                </div>
                <div>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.downtime_minutes}
                    onChange={(e) => handleChange('downtime_minutes', e.target.value)}
                    className="input-dark h-12 text-white"
                    placeholder="Menit"
                    data-testid="input-minutes"
                  />
                  <p className="text-xs text-slate-500 mt-1">Menit</p>
                </div>
              </div>
              <p className="text-xs text-amber-400">
                ⚠️ Hitung downtime dalam MENIT sesuai SOP (dari Open Ticket hingga Close)
              </p>
            </div>

            {/* Month & Year */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Bulan</Label>
                <Select value={String(formData.month)} onValueChange={(v) => handleChange('month', parseInt(v))}>
                  <SelectTrigger className="input-dark h-12" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {months.map((month) => (
                      <SelectItem key={month.value} value={String(month.value)}>
                        {month.label} ({month.days} hari)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Tahun</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleChange('year', e.target.value)}
                  className="input-dark h-12 text-white"
                  data-testid="input-year"
                />
              </div>
            </div>

            <Button 
              onClick={handleCalculate} 
              disabled={loading} 
              className="w-full h-12 btn-primary"
              data-testid="calculate-btn"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Calculator className="w-5 h-5 mr-2" />
                  Hitung Restitusi
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Result Card */}
        <div className="space-y-6">
          {result ? (
            <>
              {/* SLA Status */}
              <div className={`glass-card rounded-xl p-6 border-l-4 ${
                result.sla_met ? 'border-emerald-500' : 'border-rose-500'
              }`}>
                <div className="flex items-center gap-4">
                  {result.sla_met ? (
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-emerald-400" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-rose-500/20 flex items-center justify-center">
                      <AlertTriangle className="w-7 h-7 text-rose-400" />
                    </div>
                  )}
                  <div>
                    <p className={`text-lg font-semibold ${result.sla_met ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {result.sla_met ? 'SLA Terpenuhi (99.5%)' : 'SLA Tidak Terpenuhi'}
                    </p>
                    <p className="text-slate-400">
                      Uptime: {result.uptime_percentage}% (Target: {result.sla_target}%)
                    </p>
                  </div>
                </div>
              </div>

              {/* Result Details */}
              <div className="glass-card rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                  <ServiceIcon className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                      {result.service_name}
                    </h3>
                    
                    {/* ---> NAMA TITIK LAYANAN MUNCUL DI SINI <--- */}
                    {result.point_name && (
                      <p className="text-md font-medium text-slate-700 dark:text-slate-200 mt-1 mb-1">
                        {result.point_name}
                      </p>
                    )}

                    <p className="text-sm text-slate-500">
                      {months.find(m => m.value === result.month)?.label} {result.year}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Variabel Rumus</h4>
                  
                  <ResultRow 
                    label="C (Total Menit/Bulan)" 
                    value={`${result.total_minutes_in_month.toLocaleString('id-ID')} menit`}
                    detail={`${months.find(m => m.value === result.month)?.days} hari × 24 jam × 60 menit`}
                  />
                  <ResultRow 
                    label="Av (Toleransi 0.5%)" 
                    value={formatMinutes(result.allowed_downtime_minutes)}
                    detail="Jatah downtime yang diizinkan kontrak"
                    icon={TrendingUp}
                    iconColor="text-emerald-400"
                  />
                  <ResultRow 
                    label="A (Downtime Aktual)" 
                    value={formatMinutes(result.actual_downtime_minutes)}
                    detail="Total mati jaringan dari tiket"
                    icon={TrendingDown}
                    iconColor="text-rose-400"
                  />
                  <ResultRow 
                    label="Downtime Berlebih (A - Av)" 
                    value={formatMinutes(result.excess_downtime_minutes)}
                    detail={result.excess_downtime_minutes > 0 ? 'Yang dihitung untuk restitusi' : 'Masih dalam toleransi'}
                    highlight={result.excess_downtime_minutes > 0}
                  />
                  
                  {/* LOGIKA DINAMIS TAMPILAN BIAYA BERDASARKAN TIPE */}
                  <div className="border-t border-slate-800 pt-4">
                    <ResultRow 
                      label="Bandwidth Terganggu" 
                      value={`${result.bandwidth_affected} Mbps`}
                      detail={isBulky ? `dari total ${result.total_bandwidth} Mbps (Bulky)` : `standar jatah ${resultServiceDef?.bwPerPoint || 0} Mbps per titik`}
                    />
                    <ResultRow 
                      label={isBulky ? "Nilai Kontrak Bulky SKPD" : "Nilai Kontrak 1 Titik (Satuan)"} 
                      value={formatCurrency(result.monthly_contract)}
                      detail={isBulky ? "Total nilai kontrak sebulan" : "Harga sewa untuk 1 titik per bulan"}
                    />
                    <ResultRow 
                      label="B (Dasar Nilai Restitusi)" 
                      value={formatCurrency(result.pro_rata_fee)}
                      detail={isBulky 
                        ? `${((result.bandwidth_affected / result.total_bandwidth) * 100).toFixed(2)}% pro-rata dari nilai kontrak bulky` 
                        : `Sesuai harga sewa 1 titik (Sistem Satuan)`}
                    />
                  </div>
                </div>

                {/* Restitution Amount */}
                <div className="pt-4 border-t border-slate-800">
                  <div className="bg-slate-800/50 rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-1">Estimasi Restitusi</p>
                    <p className={`text-3xl font-bold ${
                      result.restitution_amount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`} data-testid="restitution-result">
                      {formatCurrency(result.restitution_amount)}
                    </p>
                    {result.restitution_amount > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        = (({result.excess_downtime_minutes} menit) / {result.total_minutes_in_month}) × {formatCurrency(result.pro_rata_fee)}
                      </p>
                    )}
                    {result.restitution_amount === 0 && (
                      <p className="text-xs text-emerald-400 mt-2">
                        ✓ Downtime masih dalam toleransi 0.5% - tidak ada potongan
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-xl p-12 text-center">
              <Calculator className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Hitung Restitusi</h3>
              <p className="text-slate-400">
                Masukkan data di form untuk menghitung estimasi restitusi sesuai SOP
              </p>
            </div>
          )}

          {/* Example Card yang Dinamis */}
          <div className="glass-card rounded-xl p-4 border-l-4 border-amber-500">
            <h4 className="text-white font-medium mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Contoh Perhitungan {formData.service_type === 'skpd' ? 'SKPD (Bulky)' : formData.service_type ? 'CCTV/Speaker (Satuan)' : ''}
            </h4>
            <p className="text-sm text-slate-400">
              Jika jaringan mati <strong className="text-white">10 jam (600 menit)</strong> di bulan November (30 hari):
            </p>
            <ul className="text-xs text-slate-500 mt-2 space-y-1">
              <li>• C = 43.200 menit (30×24×60)</li>
              <li>• Av = 216 menit (0.5% × 43.200)</li>
              <li>• A = 600 menit</li>
              <li>• Excess = 384 menit (600 - 216)</li>
              <li>• Restitusi = (384/43.200) × {formData.service_type === 'skpd' ? 'B (Nilai Pro-Rata)' : 'B (Harga 1 Titik)'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const ResultRow = ({ label, value, detail, icon: Icon, iconColor, highlight }) => (
  <div className="flex items-start justify-between py-2">
    <div className="flex items-start gap-2">
      {Icon && <Icon className={`w-4 h-4 mt-0.5 ${iconColor}`} />}
      <div>
        <span className="text-slate-400 text-sm">{label}</span>
        {detail && <p className="text-xs text-slate-600">{detail}</p>}
      </div>
    </div>
    <span className={`text-sm font-medium ${highlight ? 'text-rose-400' : 'text-white'}`}>{value}</span>
  </div>
);

export default RestitutionPage;