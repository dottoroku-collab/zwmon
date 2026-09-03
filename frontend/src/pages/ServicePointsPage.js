import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  MapPin, 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  Camera,
  Server,
  Megaphone,
  Loader2,
  Wifi,
  Eye,
  EyeOff
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapEvents({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
    }
  });
  return null;
}

const serviceConfig = {
  cctv: { label: 'Jaringan CCTV', icon: Camera, color: 'cyan', totalBw: 4900, defaultBw: 10 },
  skpd: { label: 'Internet SKPD', icon: Server, color: 'emerald', totalBw: 5500, defaultBw: 50 },
  ip_speaker: { label: 'IP Speaker', icon: Megaphone, color: 'amber', totalBw: 500, defaultBw: 5 }
};

const ServicePointsPage = () => {
  const { api } = useApp();
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Toggle visibility password CCTV
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [tempCoord, setTempCoord] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    address: '',
    service_type: 'cctv',
    bandwidth: '',
    ip_address: '',
    coordinates: '',
    cctv_username: 'admin',
    cctv_password: '',
    cctv_brand: 'hikvision'
  });

  useEffect(() => {
    fetchPoints();
  }, []);

  const fetchPoints = async () => {
    try {
      const response = await api.getServicePoints();
      setPoints(response.data.points || []);
    } catch (error) {
      toast.error('Gagal memuat data titik layanan');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      address: '',
      service_type: 'cctv',
      bandwidth: '',
      ip_address: '',
      coordinates: '',
      cctv_username: 'admin',
      cctv_password: '',
      cctv_brand: 'hikvision'
    });
    setShowPassword(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMapLocationSelect = (latlng) => {
    setTempCoord(latlng);
  };

  const confirmMapLocation = () => {
    if (tempCoord) {
      setFormData({ ...formData, coordinates: `${tempCoord.lat}, ${tempCoord.lng}` });
      setShowMapPicker(false);
    }
  };

  const openAddModal = (serviceType = 'cctv') => {
    resetForm();
    setFormData(prev => ({
      ...prev,
      service_type: serviceType,
      bandwidth: serviceConfig[serviceType].defaultBw.toString()
    }));
    setShowAddModal(true);
  };

  const openEditModal = (point) => {
    setSelectedPoint(point);
    setFormData({
      name: point.name,
      location: point.location,
      address: point.address,
      service_type: point.service_type,
      bandwidth: point.bandwidth.toString(),
      ip_address: point.ip_address || '',
      coordinates: point.coordinates || '',
      cctv_username: point.cctv_username || 'admin',
      cctv_password: point.cctv_password || '',
      cctv_brand: point.cctv_brand || 'hikvision'
    });
    setShowPassword(false);
    setShowEditModal(true);
  };

  const openDeleteDialog = (point) => {
    setSelectedPoint(point);
    setShowDeleteDialog(true);
  };

  const handleAddPoint = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.location || !formData.bandwidth) {
      toast.error('Mohon lengkapi field yang diperlukan');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        bandwidth: parseFloat(formData.bandwidth)
      };

      // Kalau bukan CCTV, tidak usah kirim data cctv-nya
      if (formData.service_type !== 'cctv') {
        delete payload.cctv_username;
        delete payload.cctv_password;
        delete payload.cctv_brand;
      }

      await api.createServicePoint(payload);
      toast.success('Titik layanan berhasil ditambahkan');
      setShowAddModal(false);
      resetForm();
      fetchPoints();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menambahkan titik layanan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPoint = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const payload = {
        name: formData.name,
        location: formData.location,
        address: formData.address,
        bandwidth: parseFloat(formData.bandwidth),
        ip_address: formData.ip_address,
        coordinates: formData.coordinates
      };

      if (formData.service_type === 'cctv') {
        payload.cctv_username = formData.cctv_username;
        payload.cctv_password = formData.cctv_password;
        payload.cctv_brand = formData.cctv_brand;
      }

      await api.updateServicePoint(selectedPoint.id, payload);
      toast.success('Titik layanan berhasil diupdate');
      setShowEditModal(false);
      fetchPoints();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengupdate titik layanan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePoint = async () => {
    setSubmitting(true);
    try {
      await api.deleteServicePoint(selectedPoint.id);
      toast.success('Titik layanan berhasil dihapus');
      setShowDeleteDialog(false);
      setSelectedPoint(null);
      fetchPoints();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menghapus titik layanan');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPoints = points.filter(point => {
    const matchesSearch = 
      point.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      point.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (point.address && point.address.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTab = activeTab === 'all' || point.service_type === activeTab;
    return matchesSearch && matchesTab;
  });

  // Calculate stats per service
  const stats = {
    cctv: points.filter(p => p.service_type === 'cctv'),
    skpd: points.filter(p => p.service_type === 'skpd'),
    ip_speaker: points.filter(p => p.service_type === 'ip_speaker')
  };

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
          <h1 className="text-2xl font-bold text-white">Master Data Titik Layanan</h1>
          <p className="text-slate-400">Kelola titik CCTV, SKPD, dan IP Speaker</p>
        </div>
        <Button onClick={() => openAddModal(activeTab === 'all' ? 'cctv' : activeTab)} className="btn-primary" data-testid="add-point-btn">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Titik
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(serviceConfig).map(([key, config]) => {
          const Icon = config.icon;
          const svcPoints = stats[key];
          const totalBw = svcPoints.reduce((acc, p) => acc + p.bandwidth, 0);
          
          return (
            <div key={key} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-${config.color}-500/20 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${config.color}-400`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-400">{config.label}</p>
                  <p className="text-xl font-bold text-white">{svcPoints.length} Titik</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Total BW</p>
                  <p className={`text-sm font-medium text-${config.color}-400`}>{totalBw} Mbps</p>
                  <p className="text-xs text-slate-600">dari {config.totalBw} Mbps</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs & Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="all" className="data-[state=active]:bg-rose-500">Semua</TabsTrigger>
            <TabsTrigger value="cctv" className="data-[state=active]:bg-cyan-500">CCTV</TabsTrigger>
            <TabsTrigger value="skpd" className="data-[state=active]:bg-emerald-500">SKPD</TabsTrigger>
            <TabsTrigger value="ip_speaker" className="data-[state=active]:bg-amber-500">IP Speaker</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Cari titik layanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark pl-10 h-11 text-white"
              data-testid="search-points"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-6">
          {/* Points Table */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="hidden lg:grid grid-cols-12 gap-4 p-4 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 font-medium border-b border-slate-800">
              <div className="col-span-3">Nama Titik</div>
              <div className="col-span-2">Lokasi</div>
              <div className="col-span-2">Layanan</div>
              <div className="col-span-2">Bandwidth</div>
              <div className="col-span-2">IP Address</div>
              <div className="col-span-1">Aksi</div>
            </div>

            {filteredPoints.length === 0 ? (
              <div className="p-12 text-center">
                <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Tidak ada titik layanan</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {filteredPoints.map((point) => {
                  const config = serviceConfig[point.service_type];
                  const Icon = config?.icon || MapPin;
                  
                  return (
                    <div key={point.id} className="p-4 hover:bg-white/5 transition-colors" data-testid={`point-row-${point.id}`}>
                      <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-3 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg bg-${config?.color || 'slate'}-500/20 flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 text-${config?.color || 'slate'}-400`} />
                          </div>
                          <div>
                            <p className="text-white font-medium">{point.name}</p>
                            <p className="text-xs text-slate-500 truncate">{point.address}</p>
                          </div>
                        </div>
                        <div className="col-span-2 text-sm text-slate-300">{point.location}</div>
                        <div className="col-span-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium bg-${config?.color || 'slate'}-500/20 text-${config?.color || 'slate'}-400`}>
                            {config?.label || point.service_type}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <Wifi className="w-4 h-4 text-slate-500" />
                            <span className="text-white font-mono">{point.bandwidth} Mbps</span>
                          </div>
                        </div>
                        <div className="col-span-2 text-sm text-slate-400 font-mono">
                          {point.ip_address || '-'}
                        </div>
                        <div className="col-span-1 flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditModal(point)} className="text-slate-400 hover:text-cyan-400">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(point)} className="text-slate-400 hover:text-rose-400">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Mobile View */}
                      <div className="lg:hidden space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg bg-${config?.color || 'slate'}-500/20 flex items-center justify-center`}>
                              <Icon className={`w-5 h-5 text-${config?.color || 'slate'}-400`} />
                            </div>
                            <div>
                              <p className="text-white font-medium">{point.name}</p>
                              <p className="text-xs text-slate-500">{point.location}</p>
                            </div>
                          </div>
                          <span className="text-sm font-mono text-cyan-400">{point.bandwidth} Mbps</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded text-xs font-medium bg-${config?.color || 'slate'}-500/20 text-${config?.color || 'slate'}-400`}>
                            {config?.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEditModal(point)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(point)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-rose-400" />
              Tambah Titik Layanan
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPoint} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Jenis Layanan *</Label>
              <Select value={formData.service_type} onValueChange={(v) => setFormData({...formData, service_type: v, bandwidth: serviceConfig[v].defaultBw.toString()})}>
                <SelectTrigger className="input-dark h-11" data-testid="form-service-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="cctv">Jaringan CCTV</SelectItem>
                  <SelectItem value="skpd">Internet SKPD</SelectItem>
                  <SelectItem value="ip_speaker">IP Speaker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nama Titik *</Label>
                <Input name="name" value={formData.name} onChange={handleChange} className="input-dark h-11 text-white" placeholder="Contoh: CCTV Simpang 5" required />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Lokasi *</Label>
                <Input name="location" value={formData.location} onChange={handleChange} className="input-dark h-11 text-white" placeholder="Contoh: Simpang 5" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Alamat Lengkap</Label>
              <Input name="address" value={formData.address} onChange={handleChange} className="input-dark h-11 text-white" placeholder="Contoh: Jl. Airport No. 1" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Koordinat Peta (Lat, Lng)</Label>
              <div className="flex gap-2">
                <Input name="coordinates" value={formData.coordinates} onChange={handleChange} className="input-dark h-11 text-white flex-1" placeholder="-5.1476, 119.4327" />
                <Button type="button" variant="outline" className="h-11 border-slate-700 bg-slate-800 text-slate-300 hover:text-white" onClick={() => setShowMapPicker(true)}>
                  <MapPin className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Bandwidth (Mbps) *</Label>
                <Input name="bandwidth" type="number" value={formData.bandwidth} onChange={handleChange} className="input-dark h-11 text-white" required />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">IP Address</Label>
                <Input name="ip_address" value={formData.ip_address} onChange={handleChange} className="input-dark h-11 text-white font-mono" placeholder="10.10.x.x" />
              </div>
            </div>

            {/* --- TAMBAHAN KHUSUS CCTV --- */}
            {formData.service_type === 'cctv' && (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-4">
                <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Kredensial Akses RTSP CCTV
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Brand Kamera</Label>
                    <Select value={formData.cctv_brand} onValueChange={(v) => setFormData({...formData, cctv_brand: v})}>
                      <SelectTrigger className="input-dark h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="hikvision">Hikvision</SelectItem>
                        <SelectItem value="samsung">Samsung (Hanwha)</SelectItem>
                        <SelectItem value="avigilon">Avigilon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Username</Label>
                    <Input name="cctv_username" value={formData.cctv_username} onChange={handleChange} className="input-dark h-11 text-white" placeholder="admin" />
                  </div>
                </div>
                <div className="space-y-2 relative">
                  <Label className="text-slate-300">Password</Label>
                  <div className="relative">
                    <Input 
                      name="cctv_password" 
                      type={showPassword ? "text" : "password"} 
                      value={formData.cctv_password} 
                      onChange={handleChange} 
                      className="input-dark h-11 text-white pr-10" 
                      placeholder="Masukkan password kamera" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* --------------------------- */}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="flex-1 border-slate-700">
                Batal
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 btn-primary" data-testid="submit-add-point">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tambah'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-cyan-400" />
              Edit Titik Layanan
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditPoint} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nama Titik</Label>
              <Input name="name" value={formData.name} onChange={handleChange} className="input-dark h-11 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Lokasi</Label>
                <Input name="location" value={formData.location} onChange={handleChange} className="input-dark h-11 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Bandwidth (Mbps)</Label>
                <Input name="bandwidth" type="number" value={formData.bandwidth} onChange={handleChange} className="input-dark h-11 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Alamat</Label>
              <Input name="address" value={formData.address} onChange={handleChange} className="input-dark h-11 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Koordinat Peta (Lat, Lng)</Label>
              <div className="flex gap-2">
                <Input name="coordinates" value={formData.coordinates} onChange={handleChange} className="input-dark h-11 text-white flex-1" placeholder="-5.1476, 119.4327" />
                <Button type="button" variant="outline" className="h-11 border-slate-700 bg-slate-800 text-slate-300 hover:text-white" onClick={() => setShowMapPicker(true)}>
                  <MapPin className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">IP Address</Label>
              <Input name="ip_address" value={formData.ip_address} onChange={handleChange} className="input-dark h-11 text-white font-mono" />
            </div>

            {/* --- TAMBAHAN KHUSUS CCTV --- */}
            {formData.service_type === 'cctv' && (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 space-y-4">
                <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Kredensial Akses RTSP CCTV
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Brand Kamera</Label>
                    <Select value={formData.cctv_brand} onValueChange={(v) => setFormData({...formData, cctv_brand: v})}>
                      <SelectTrigger className="input-dark h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="hikvision">Hikvision</SelectItem>
                        <SelectItem value="samsung">Samsung (Hanwha)</SelectItem>
                        <SelectItem value="avigilon">Avigilon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Username</Label>
                    <Input name="cctv_username" value={formData.cctv_username} onChange={handleChange} className="input-dark h-11 text-white" placeholder="admin" />
                  </div>
                </div>
                <div className="space-y-2 relative">
                  <Label className="text-slate-300">Password</Label>
                  <div className="relative">
                    <Input 
                      name="cctv_password" 
                      type={showPassword ? "text" : "password"} 
                      value={formData.cctv_password} 
                      onChange={handleChange} 
                      className="input-dark h-11 text-white pr-10" 
                      placeholder="Biarkan kosong jika tidak diubah" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* --------------------------- */}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="flex-1 border-slate-700">
                Batal
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1 bg-cyan-600 hover:bg-cyan-700" data-testid="submit-edit-point">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Hapus Titik Layanan?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Apakah Anda yakin ingin menghapus titik <strong className="text-white">{selectedPoint?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePoint} disabled={submitting} className="bg-rose-600 hover:bg-rose-700">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Map Picker Dialog */}
      <Dialog open={showMapPicker} onOpenChange={setShowMapPicker}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl p-0">
          <DialogHeader className="p-4 border-b border-slate-800">
            <DialogTitle>Pilih Lokasi di Peta</DialogTitle>
          </DialogHeader>
          <div className="h-[60vh] w-full relative">
            <MapContainer 
              center={tempCoord || [-5.147665, 119.432732]} 
              zoom={13} 
              className="h-full w-full z-0"
            >
              <TileLayer 
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                className="map-tiles-dark"
              />
              <MapEvents onLocationSelect={handleMapLocationSelect} />
              {tempCoord && <Marker position={tempCoord} icon={defaultIcon} />}
            </MapContainer>
          </div>
          <div className="p-4 border-t border-slate-800 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowMapPicker(false)} className="border-slate-700">Batal</Button>
            <Button onClick={confirmMapLocation} className="bg-cyan-600 hover:bg-cyan-700">Pilih Koordinat Ini</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServicePointsPage;