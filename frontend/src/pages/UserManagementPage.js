import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2,
  UserPlus,
  Loader2,
  X,
  Eye,
  EyeOff,
  Key
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

const roleLabels = {
  admin: 'Administrator',
  am: 'Account Manager',
  helpdesk: 'Helpdesk',
  eos: 'EOS Teknisi',
  client: 'Client'
};

const roleColors = {
  admin: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  am: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  helpdesk: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  eos: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  client: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

const UserManagementPage = () => {
  const { api } = useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'client'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.getUsers();
      setUsers(response.data.users || []);
    } catch (error) {
      toast.error('Gagal memuat daftar pengguna');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      phone: '',
      role: 'client'
    });
    setShowPassword(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      phone: user.phone || '',
      role: user.role
    });
    setShowEditModal(true);
  };

  const openDeleteDialog = (user) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const openResetDialog = (user) => {
    setSelectedUser(user);
    setResetPasswordInput('');
    setShowPassword(false);
    setShowResetDialog(true);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.email || !formData.password) {
      toast.error('Mohon lengkapi field yang diperlukan');
      return;
    }

    setSubmitting(true);
    try {
      await api.createUser(formData);
      toast.success('User berhasil ditambahkan');
      setShowAddModal(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menambahkan user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const updateData = {
        username: formData.username,
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone,
        role: formData.role
      };
      
      await api.updateUser(selectedUser.id, updateData);
      toast.success('User berhasil diupdate');
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengupdate user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    setSubmitting(true);
    try {
      await api.deleteUser(selectedUser.id);
      toast.success('User berhasil dihapus');
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal menghapus user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPasswordInput) {
      toast.error('Password baru tidak boleh kosong');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.resetUserPassword(selectedUser.id, { new_password: resetPasswordInput });
      toast.success('Password berhasil direset');
      setShowResetDialog(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mereset password');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const username = user.username || '';
    const email = user.email || '';
    const fullName = user.full_name || '';
    
    const matchesSearch = 
      username.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      fullName.toLowerCase().includes(searchLower);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
          <h1 className="text-2xl font-bold text-white">Kelola Pengguna</h1>
          <p className="text-slate-400">Tambah, edit, dan kelola akun pengguna sistem</p>
        </div>
        <Button onClick={openAddModal} className="btn-primary" data-testid="add-user-btn">
          <UserPlus className="w-4 h-4 mr-2" />
          Tambah User
        </Button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Cari berdasarkan nama, email, atau username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-dark pl-10 h-11 text-white"
              data-testid="search-users"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full lg:w-48 input-dark h-11" data-testid="filter-role">
              <SelectValue placeholder="Filter Role" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">Semua Role</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="am">Account Manager</SelectItem>
              <SelectItem value="helpdesk">Helpdesk</SelectItem>
              <SelectItem value="eos">EOS Teknisi</SelectItem>
              <SelectItem value="client">Client</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* User Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="hidden lg:grid grid-cols-12 gap-4 p-4 bg-slate-900/50 text-xs uppercase tracking-wider text-slate-400 font-medium border-b border-slate-800">
          <div className="col-span-3">Pengguna</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Aksi</div>
        </div>

        {/* Table Body */}
        {filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Tidak ada pengguna ditemukan</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredUsers.map((user) => (
              <div 
                key={user.id} 
                className="p-4 hover:bg-white/5 transition-colors"
                data-testid={`user-row-${user.id}`}
              >
                {/* Desktop View */}
                <div className="hidden lg:grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="text-white font-medium">
                        {user.full_name?.charAt(0)?.toUpperCase() || (user.username && user.username.charAt(0).toUpperCase()) || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{user.full_name || user.username || 'Tanpa Nama'}</p>
                      <p className="text-xs text-slate-500">{user.username ? `@${user.username}` : user.email}</p>
                    </div>
                  </div>
                  <div className="col-span-3 text-sm text-slate-300 truncate">
                    {user.email}
                  </div>
                  <div className="col-span-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.is_active !== false 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {user.is_active !== false ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openResetDialog(user)}
                      className="text-slate-400 hover:text-emerald-400"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(user)}
                      className="text-slate-400 hover:text-cyan-400"
                      data-testid={`edit-user-${user.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(user)}
                      className="text-slate-400 hover:text-rose-400"
                      data-testid={`delete-user-${user.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Mobile View */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                        <span className="text-white font-medium">
                          {user.full_name?.charAt(0)?.toUpperCase() || (user.username && user.username.charAt(0).toUpperCase()) || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{user.full_name || user.username || 'Tanpa Nama'}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.is_active !== false 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {user.is_active !== false ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openResetDialog(user)} title="Reset Password">
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(user)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
        <span>Total: {filteredUsers.length} pengguna</span>
        {Object.entries(roleLabels).map(([role, label]) => (
          <span key={role}>
            {label}: {filteredUsers.filter(u => u.role === role).length}
          </span>
        ))}
      </div>

      {/* Add User Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-rose-400" />
              Tambah User Baru
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Username *</Label>
              <Input
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                placeholder="Username"
                required
                data-testid="form-username"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email *</Label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                placeholder="email@example.com"
                required
                data-testid="form-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Password *</Label>
              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  className="input-dark h-11 text-white pr-10"
                  placeholder="Password"
                  required
                  data-testid="form-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Nama Lengkap</Label>
              <Input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                placeholder="Nama Lengkap"
                data-testid="form-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">No. Telepon</Label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                placeholder="08xxxxxxxxxx"
                data-testid="form-phone"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Role *</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                <SelectTrigger className="input-dark h-11" data-testid="form-role">
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="am">Account Manager</SelectItem>
                  <SelectItem value="helpdesk">Helpdesk</SelectItem>
                  <SelectItem value="eos">EOS Teknisi</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddModal(false)}
                className="flex-1 border-slate-700"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className="flex-1 btn-primary"
                data-testid="submit-add-user"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tambah User'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-cyan-400" />
              Edit User
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Username</Label>
              <Input
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                data-testid="edit-username"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                data-testid="edit-email"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Nama Lengkap</Label>
              <Input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                data-testid="edit-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">No. Telepon</Label>
              <Input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input-dark h-11 text-white"
                data-testid="edit-phone"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                <SelectTrigger className="input-dark h-11" data-testid="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="am">Account Manager</SelectItem>
                  <SelectItem value="helpdesk">Helpdesk</SelectItem>
                  <SelectItem value="eos">EOS Teknisi</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowEditModal(false)}
                className="flex-1 border-slate-700"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                data-testid="submit-edit-user"
              >
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
            <AlertDialogTitle className="text-white">Hapus User?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Apakah Anda yakin ingin menghapus user <strong className="text-white">{selectedUser?.full_name || selectedUser?.username}</strong>? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300">Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              disabled={submitting}
              className="bg-rose-600 hover:bg-rose-700"
              data-testid="confirm-delete-user"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Modal */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              Reset Password User
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-400 mb-4">
            Reset password untuk user <strong className="text-white">{selectedUser?.full_name || selectedUser?.username}</strong>.
          </div>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Password Baru *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  className="input-dark h-11 text-white pr-10"
                  placeholder="Masukkan password baru"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowResetDialog(false)}
                className="flex-1 border-slate-700"
              >
                Batal
              </Button>
              <Button 
                type="submit" 
                disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
