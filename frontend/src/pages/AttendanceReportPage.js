import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Map, Image as ImageIcon } from 'lucide-react';

const AttendanceReportPage = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await axios.get('/api/attendance/logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLogs(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Laporan Absensi (Face Recognition & GPS)</h1>
      </div>
      
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Waktu</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">User</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Tipe</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Lokasi</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Bukti Foto</th>
                <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Laporan</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
                    {log.photo_url || log.evidence_url ? (
                      <a href={`/api${log.photo_url || log.evidence_url}`} target="_blank" rel="noreferrer">
                        <img 
                          src={`/api${log.photo_url || log.evidence_url}`} 
                          alt="Bukti" 
                          className="w-12 h-12 object-cover rounded bg-slate-100 dark:bg-slate-800"
                        />
                      </a>
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-700 dark:text-slate-300 max-w-xs truncate">
                    {log.report_text || '-'}
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
    </div>
  );
};

export default AttendanceReportPage;
