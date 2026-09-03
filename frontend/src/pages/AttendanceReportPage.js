import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Map, X, Trash2, Calendar, User as UserIcon, Filter, Clock, Image as ImageIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

const AttendanceReportPage = () => {
  const [logs, setLogs] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Filters
  const [filterUser, setFilterUser] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const { api, user } = useApp();

  const [eligibleUsers, setEligibleUsers] = useState([]);
  const isAdminOrAM = user?.role === 'admin' || user?.role === 'am';

  useEffect(() => {
    fetchLogs();
    if (isAdminOrAM) {
      fetchEligibleUsers();
    }
  }, [user]);

  const fetchEligibleUsers = async () => {
    try {
      const response = await api.getUsers();
      if (response.data && Array.isArray(response.data.users)) {
        const filtered = response.data.users.filter(u => u.role === 'eos' || u.role === 'helpdesk');
        setEligibleUsers(filtered.map(u => u.full_name || u.username).sort());
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get('/api/attendance/logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (Array.isArray(response.data)) {
        setLogs(response.data);
      } else {
        console.error("Expected array but got:", typeof response.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus data absensi beserta foto ini?")) {
      try {
        await api.deleteAttendanceLog(id);
        fetchLogs();
      } catch (err) {
        console.error("Failed to delete", err);
        alert("Gagal menghapus data");
      }
    }
  };

  // Apply filters
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const userName = log.full_name || log.username;
      
      // Hide ghost logs (AM/Admin logs) from the list if viewed by Admin/AM
      if (isAdminOrAM && eligibleUsers.length > 0) {
        if (!eligibleUsers.includes(userName)) return false;
      }
      
      // Filter by User
      if (isAdminOrAM && filterUser !== 'All' && userName !== filterUser) return false;
      
      // Filter by Type
      if (filterType !== 'All' && log.type !== filterType) return false;
      
      // Filter by Date
      const logDate = new Date(log.timestamp);
      if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        if (logDate < startDate) return false;
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        if (logDate > endDate) return false;
      }
      
      return true;
    });
  }, [logs, filterUser, filterType, dateRange]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="space-y-6 relative pb-10">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Galeri Absensi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Pantau foto absensi tim di lapangan</p>
        </div>
      </div>
      
      {/* Filters Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-center transition-all">
        <div className="flex items-center text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
          <Filter size={18} className="mr-2 text-blue-500" /> Filter:
        </div>
        
        <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
          {/* User Filter */}
          {isAdminOrAM && (
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon size={16} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none font-medium transition-all"
              >
                <option value="All">Semua Tim</option>
                {eligibleUsers.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          )}

          {/* Type Filter */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Clock size={16} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none font-medium transition-all"
            >
              <option value="All">Semua Absen</option>
              <option value="clock_in">Clock In</option>
              <option value="clock_out">Clock Out</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2 flex-[1.5]">
            <div className="relative flex-1">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium text-sm transition-all"
              />
            </div>
            <span className="text-slate-400 font-medium">-</span>
            <div className="relative flex-1">
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium text-sm transition-all"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Grid Layout */}
      {filteredLogs.length > 0 ? (
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {filteredLogs.map((log) => (
            <motion.div 
              key={log._id || log.id}
              variants={itemVariants}
              className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group flex flex-col"
            >
              {/* Image Section */}
              <div 
                className="relative h-56 w-full overflow-hidden cursor-pointer bg-slate-100 dark:bg-slate-800"
                onClick={() => log.photo_url && setSelectedImage(log.photo_url)}
              >
                {log.photo_url ? (
                  <img 
                    src={log.photo_url.startsWith('http') ? log.photo_url : log.photo_url} 
                    alt="Bukti Absen" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon size={32} className="mb-2 opacity-50" />
                    <span className="text-xs font-medium">Tidak ada foto</span>
                  </div>
                )}
                
                {/* Gradient Overlay for better contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>

                {/* Badge Type overlay */}
                <div className="absolute top-3 left-3">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-md backdrop-blur-md border ${
                    log.type === 'clock_in' 
                      ? 'bg-emerald-500/90 text-white border-emerald-400/30'
                      : 'bg-rose-500/90 text-white border-rose-400/30'
                  }`}>
                    {log.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                  </span>
                </div>

                {/* Delete Button overlay */}
                {user?.role === 'admin' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(log._id || log.id); }}
                    className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-rose-600 text-white rounded-full backdrop-blur-md transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg translate-x-2 group-hover:translate-x-0"
                    title="Hapus Data"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              
              {/* Info Section */}
              <div className="p-4 flex flex-col flex-1 gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1 text-base">
                    {log.full_name || log.username}
                  </h3>
                  <div className="flex items-center text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 bg-slate-50 dark:bg-slate-800/50 w-fit px-2 py-1 rounded-md">
                    <Calendar size={12} className="mr-1.5 text-blue-500" />
                    {new Date(log.timestamp).toLocaleString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
                
                <div className="mt-auto">
                  <a 
                    href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center w-full justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 dark:bg-slate-800/50 dark:hover:bg-blue-900/30 dark:text-slate-300 dark:hover:text-blue-400 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700/50"
                  >
                    <Map size={14} /> Lihat Lokasi Maps
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-24 text-slate-500 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"
        >
          <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-5 shadow-sm border border-slate-100 dark:border-slate-700">
            <Filter size={32} className="text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Tidak Ada Data</p>
          <p className="text-sm text-slate-500 max-w-sm text-center">Data absensi tidak ditemukan. Coba sesuaikan filter pencarian untuk menemukan data yang Anda inginkan.</p>
        </motion.div>
      )}

      {/* Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-8"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative max-w-5xl w-full h-full flex flex-col justify-center items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex justify-end mb-4">
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="text-white/70 hover:text-white bg-white/10 hover:bg-rose-500 p-3 rounded-full backdrop-blur-md transition-all flex items-center gap-2 group"
                >
                  <X size={20} className="group-hover:rotate-90 transition-transform duration-300" /> 
                  <span className="text-sm font-semibold pr-1 hidden md:block">Tutup Galeri</span>
                </button>
              </div>
              <img 
                src={selectedImage.startsWith('http') ? selectedImage : selectedImage} 
                alt="Preview Absensi" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceReportPage;
