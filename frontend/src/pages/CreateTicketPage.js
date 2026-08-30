import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import axios from 'axios'; // <--- TAMBAHKAN INI KA'
import { 
  ArrowLeft, 
  Camera, 
  Server, 
  Megaphone,
  Upload,
  X,
  Loader2,
  MapPin
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const serviceOptions = [
  { value: 'cctv', label: 'Jaringan CCTV', icon: Camera, description: '4900 Mbps, 240 titik' },
  { value: 'skpd', label: 'Internet Dedicated SKPD', icon: Server, description: '5500 Mbps' },
  { value: 'ip_speaker', label: 'IP Speaker', icon: Megaphone, description: '500 Mbps, 5 Mbps per titik' },
];

const priorityOptions = [
  { value: 'low', label: 'Rendah', description: 'Tidak mendesak' },
  { value: 'medium', label: 'Sedang', description: 'Perlu ditangani segera' },
  { value: 'high', label: 'Tinggi', description: 'Dampak signifikan' },
  { value: 'critical', label: 'Kritis', description: 'Layanan tidak berfungsi' },
];

const indicationOptions = {
  cctv: ['RTO (Request Timeout)', 'DHU (Destination Host Unreachable)', 'Gambar Blank/Hitam', 'Gambar Freeze', 'Kamera Offline'],
  skpd: ['Internet Mati Total', 'Internet Lambat', 'Intermittent', 'RTO', 'Tidak Bisa Akses Website'],
  ip_speaker: ['Speaker Tidak Bunyi', 'Suara Putus-putus', 'RTO', 'Internet Mati']
};

const CreateTicketPage = () => {
  const navigate = useNavigate();
  // Ambil API URL dari context supaya bisa dipakai axios
  const { api, API } = useApp(); 
  const [loading, setLoading] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false); // <--- STATE BARU UNTUK LOADING FOTO
  const [servicePoints, setServicePoints] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    service_type: '',
    service_point_id: '',
    location: '',
    priority: 'medium',
    initial_indication: '',
    photos: [],
    created_at: ''
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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectChange = (name, value) => {
    const newFieldValue = value === "manual" ? "" : value;

    setFormData(prev => {
      const newFormData = { ...prev, [name]: newFieldValue };

      const point = servicePoints.find(p => p.id === newFormData.service_point_id);
      const pointName = point ? point.name : '';
      const indicationText = newFormData.initial_indication || '';

      if (name === 'service_point_id') {
        newFormData.location = pointName;
      }

      if (name === 'service_point_id' || name === 'initial_indication' || name === 'service_type') {
        newFormData.title = `${pointName} ${indicationText}`.trim();
      }

      if (name === 'service_type') {
        newFormData.service_point_id = '';
        newFormData.initial_indication = '';
        newFormData.title = '';
        newFormData.location = '';
      }

      return newFormData;
    });
  };

  // --- LOGIKA UPLOAD FOTO YANG BARU ---
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploadingPhoto(true);
    const uploadedUrls = [];

    try {
      for (const file of files) {
        // Siapkan data sebagai form-data layaknya upload file asli
        const uploadData = new FormData();
        uploadData.append('file', file);

        // Tembak ke endpoint upload-photo di backend
        const res = await axios.post(`${API}/upload-photo`, uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data && res.data.photo_url) {
          uploadedUrls.push(res.data.photo_url);
        }
      }

      // Masukkan URL yang didapat dari server ke state foto
      setFormData(prev => ({
        ...prev,
        photos: [...prev.photos, ...uploadedUrls]
      }));
      toast.success(`${uploadedUrls.length} foto berhasil diunggah`);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengunggah foto. Pastikan ukuran dan formatnya sesuai (JPG/PNG).');
    } finally {
      setIsUploadingPhoto(false);
      // Reset input supaya bisa pilih file yang sama lagi kalau mau
      e.target.value = null; 
    }
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.service_type || !formData.location) {
      toast.error('Mohon lengkapi semua field yang diperlukan');
      return;
    }

    setLoading(true);
    try {
      const submissionData = {
        ...formData,
        created_at: formData.created_at ? new Date(formData.created_at).toISOString() : null
      };

      const response = await api.createTicket(submissionData);
      toast.success(`Tiket berhasil dibuat: ${response.data.ticket_id}`);
      navigate('/tickets');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat tiket');
    } finally {
      setLoading(false);
    }
  };

  const currentIndications = indicationOptions[formData.service_type] || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
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
        <div>
          <h1 className="text-2xl font-bold text-white">Buat Tiket Baru</h1>
          <p className="text-slate-400">Laporkan gangguan layanan</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service Type */}
        <div className="glass-card rounded-xl p-6">
          <Label className="text-white text-lg mb-4 block">Pilih Layanan *</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {serviceOptions.map((service) => {
              const Icon = service.icon;
              const isSelected = formData.service_type === service.value;
              
              return (
                <button
                  key={service.value}
                  type="button"
                  onClick={() => handleSelectChange('service_type', service.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected 
                      ? 'border-rose-500 bg-rose-500/10' 
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                  }`}
                  data-testid={`service-${service.value}`}
                >
                  <Icon className={`w-8 h-8 mb-3 ${isSelected ? 'text-rose-400' : 'text-slate-400'}`} />
                  <p className={`font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {service.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{service.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Service Point Selection */}
        {formData.service_type && servicePoints.length > 0 && (
          <div className="glass-card rounded-xl p-6">
            <Label className="text-white text-lg mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Pilih Titik Layanan
            </Label>
            <Select 
              value={formData.service_point_id || "manual"} 
              onValueChange={(v) => handleSelectChange('service_point_id', v)}
            >
              <SelectTrigger className="input-dark h-12" data-testid="service-point-select">
                <SelectValue placeholder="Pilih titik layanan (akan auto-fill lokasi)" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="manual">Input Lokasi Manual</SelectItem>
                {servicePoints.map((point) => (
                  <SelectItem key={point.id} value={point.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{point.name}</span>
                      <span className="text-xs text-slate-500">{point.bandwidth} Mbps</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Ticket Details */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          {/* Indikasi Gangguan */}
          {formData.service_type && currentIndications.length > 0 && (
            <div className="space-y-2">
              <Label className="text-slate-300">Indikasi Gangguan *</Label>
              <Select value={formData.initial_indication || undefined} onValueChange={(v) => handleSelectChange('initial_indication', v)}>
                <SelectTrigger className="input-dark h-12" data-testid="indication-select">
                  <SelectValue placeholder="Pilih indikasi gangguan" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {currentIndications.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title" className="text-slate-300">Judul Gangguan *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="input-dark h-12 text-white"
              placeholder="Contoh: CCTV Simpang 5 RTO"
              required
              data-testid="ticket-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-slate-300">Deskripsi Gangguan *</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input-dark min-h-[120px] text-white"
              placeholder="Jelaskan detail gangguan yang terjadi..."
              required
              data-testid="ticket-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-slate-300">Lokasi/Alamat *</Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="input-dark h-12 text-white"
              placeholder="Contoh: Jl. Sudirman No. 123"
              required
              data-testid="ticket-location"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Prioritas</Label>
            <Select value={formData.priority} onValueChange={(v) => handleSelectChange('priority', v)}>
              <SelectTrigger className="input-dark h-12" data-testid="ticket-priority">
                <SelectValue placeholder="Pilih prioritas" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {priorityOptions.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center gap-2">
                      <span>{priority.label}</span>
                      <span className="text-xs text-slate-500">- {priority.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="glass-card rounded-xl p-6">
          <Label className="text-white text-lg mb-4 block">Upload Foto Eviden Awal *</Label>
          <p className="text-sm text-slate-400 mb-4">Lampirkan screenshot/foto kondisi gangguan dari War Room atau lokasi</p>
          
          <div className="space-y-4">
            <label className={`file-input-label flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-colors ${
              isUploadingPhoto ? 'border-slate-600 bg-slate-800/50 cursor-not-allowed' : 'border-slate-700 hover:border-rose-500 cursor-pointer'
            }`}>
              {isUploadingPhoto ? (
                <>
                  <Loader2 className="w-8 h-8 text-rose-500 mb-2 animate-spin" />
                  <span className="text-sm text-slate-400">Mengunggah file ke server...</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-500 mb-2" />
                  <span className="text-sm text-slate-400">Klik untuk upload foto</span>
                  <span className="text-xs text-slate-500">PNG, JPG hingga 5MB</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                disabled={isUploadingPhoto}
                className="hidden"
                data-testid="photo-upload"
              />
            </label>

            {formData.photos.length > 0 && (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {formData.photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`remove-photo-${index}`}
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Backdate Input (Opsional) */}
        <div className="glass-card rounded-xl p-6 border-l-4 border-amber-500/50">
          <Label className="text-white text-lg mb-2 flex items-center gap-2">
             <span className="text-amber-400">📅</span> Waktu Kejadian
          </Label>
          <Input
            type="datetime-local"
            name="created_at"
            value={formData.created_at}
            onChange={handleChange}
            className="input-dark h-12 text-white scheme-dark"
            data-testid="ticket-backdate"
          />
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/tickets')}
            className="flex-1 h-12 border-slate-700"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={loading || isUploadingPhoto}
            className="flex-1 h-12 btn-primary"
            data-testid="submit-ticket-btn"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Buat Tiket'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateTicketPage;