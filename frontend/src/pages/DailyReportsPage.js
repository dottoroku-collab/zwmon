import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Trash2, 
  Filter,
  Calendar,
  User as UserIcon,
  Search,
  Image as ImageIcon,
  X,
  Maximize2
} from 'lucide-react';
import axios from 'axios';

const DailyReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterUser, setFilterUser] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Modal
  const [selectedImage, setSelectedImage] = useState(null);

  const { api, user } = useApp();

  const [eligibleUsers, setEligibleUsers] = useState([]);
  const isAdminOrAM = user?.role === 'admin' || user?.role === 'am';

  useEffect(() => {
    fetchReports();
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

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.getDailyReports();
      if (Array.isArray(response.data)) {
        setReports(response.data);
      } else {
        console.error("Expected array but got:", typeof response.data);
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil data laporan pekerjaan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus laporan harian ini beserta foto buktinya?")) {
      try {
        await api.deleteDailyReport(id);
        toast.success("Laporan berhasil dihapus");
        fetchReports();
      } catch (err) {
        console.error("Failed to delete", err);
        toast.error("Gagal menghapus laporan");
      }
    }
  };

  // Apply filters
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const userName = report.full_name || report.username;
      
      // Filter by User (only for Admin/AM)
      if (isAdminOrAM && eligibleUsers.length > 0) {
        if (!eligibleUsers.includes(userName)) return false;
      }
      if (isAdminOrAM && filterUser !== 'All' && userName !== filterUser) return false;
      
      // Filter by Date
      if (dateRange.start || dateRange.end) {
        const reportDate = report.date;
        if (dateRange.start && reportDate < dateRange.start) return false;
        if (dateRange.end && reportDate > dateRange.end) return false;
      }
      
      return true;
    });
  }, [reports, filterUser, dateRange, isAdminOrAM, eligibleUsers]);

  // Format API URL for image
  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    
    let cleanUrl = url;
    if (cleanUrl.startsWith('/api')) {
      cleanUrl = cleanUrl.substring(4);
    }
    const backendUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || window.location.origin;
    return `${backendUrl}${cleanUrl}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-screen">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-500" />
          Laporan Pekerjaan
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Pantau logbook dan aktivitas harian tim lapangan
        </p>
      </div>

      {/* Filter Section */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 md:w-32">
            <Filter size={18} />
            <span className="font-medium">Filter:</span>
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

            {/* Date Range Filter */}
            <div className="flex-1 flex gap-2">
              <div className="relative flex-1 group">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                />
              </div>
              <span className="flex items-center text-slate-400">-</span>
              <div className="relative flex-1 group">
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setFilterUser('All');
              setDateRange({ start: '', end: '' });
            }}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Tidak ada data</h3>
          <p className="text-slate-500 dark:text-slate-400">Belum ada laporan harian yang sesuai dengan filter Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredReports.map((report) => (
              <motion.div
                key={report._id || report.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow group flex flex-col"
              >
                {/* Image Section */}
                <div 
                  className="relative aspect-video bg-slate-100 dark:bg-slate-800 cursor-pointer overflow-hidden"
                  onClick={() => setSelectedImage(getImageUrl(report.evidence_url))}
                >
                  {report.evidence_url ? (
                    <>
                      <img 
                        src={getImageUrl(report.evidence_url)}
                        alt="Evidence" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 drop-shadow-lg" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                      <span className="text-sm font-medium">Tidak ada foto</span>
                    </div>
                  )}
                  
                  {isAdminOrAM && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(report._id || report.id);
                      }}
                      className="absolute top-3 right-3 p-2 bg-white/90 dark:bg-slate-900/90 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/20 text-slate-600 dark:text-slate-300 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                      title="Hapus laporan"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate" title={report.full_name || report.username}>
                        {report.full_name || report.username}
                      </h3>
                      <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <Calendar size={12} className="mr-1" />
                        {new Date(report.timestamp).toLocaleString('id-ID', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 whitespace-pre-wrap">
                    {report.report_text}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Fullscreen Image Modal */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X size={24} />
            </motion.button>
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={selectedImage}
              alt="Bukti Laporan"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DailyReportsPage;
