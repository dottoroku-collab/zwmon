import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Map, Image as ImageIcon, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

const AttendanceReportPage = () => {
  const [logs, setLogs] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const { theme } = useApp();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchLogs();
  }, []);

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

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Laporan Absensi & Pekerjaan</h1>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Waktu</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">User</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Tipe</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Lokasi</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Bukti Absensi</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Laporan Pekerjaan</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id || log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-900 dark:text-white">
                    {log.full_name || log.username}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.type === 'clock_in' 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                    }`}>
                      {log.type === 'clock_in' ? 'Clock In' : 'Clock Out'}
                    </span>
                  </td>
                  <td className="p-4">
                    <a 
                      href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      <Map size={16} /> Buka Map
                    </a>
                  </td>
                  <td className="p-4">
                    {log.photo_url ? (
                      <div 
                        onClick={() => setSelectedImage(log.photo_url)}
                        className="cursor-pointer overflow-hidden rounded border border-slate-200 dark:border-slate-700 w-16 h-16 hover:opacity-80 transition-opacity"
                      >
                        <img 
                          src={log.photo_url.startsWith('http') ? log.photo_url : `/api${log.photo_url}`} 
                          alt="Bukti Absen" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    {log.type === 'clock_out' ? (
                      <div className="flex flex-col gap-2 max-w-xs">
                        <span className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                          {log.report_text || <span className="italic text-slate-400">Tidak ada teks laporan</span>}
                        </span>
                        {log.evidence_url && (
                          <div 
                            onClick={() => setSelectedImage(log.evidence_url)}
                            className="cursor-pointer overflow-hidden rounded border border-slate-200 dark:border-slate-700 w-16 h-16 hover:opacity-80 transition-opacity"
                          >
                            <img 
                              src={log.evidence_url.startsWith('http') ? log.evidence_url : `/api${log.evidence_url}`} 
                              alt="Bukti Pekerjaan" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs italic text-slate-400">- Hanya saat Clock Out -</span>
                    )}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-slate-500">
                    Belum ada data absensi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full flex justify-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
              className="absolute -top-12 right-0 md:-right-12 text-white hover:text-rose-400 transition-colors bg-slate-900/50 p-2 rounded-full"
            >
              <X size={24} />
            </button>
            <img 
              src={selectedImage.startsWith('http') ? selectedImage : `/api${selectedImage}`} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceReportPage;
