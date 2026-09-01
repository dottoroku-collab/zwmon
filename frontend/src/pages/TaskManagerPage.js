import React, { useState, useEffect, useContext } from 'react';
import Layout from '../components/Layout';
import AppContext from '../context/AppContext';
import { 
  CheckSquare, 
  Plus, 
  Clock, 
  AlertCircle,
  MessageSquare,
  Paperclip,
  MoreVertical,
  User,
  X
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-700' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-600' },
  { id: 'blocked', title: 'Blocked', color: 'bg-red-600' },
  { id: 'review', title: 'Review', color: 'bg-yellow-600' },
  { id: 'done', title: 'Done', color: 'bg-emerald-600' }
];

export default function TaskManagerPage() {
  const { api, user } = useContext(AppContext);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskLogs, setTaskLogs] = useState([]);
  
  // Form Create
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignee_id: '',
    sla_hours: 12
  });

  // Form Log
  const [newLog, setNewLog] = useState({ message: '', action: 'update_progress', photo: null });

  const isManager = user?.role === 'admin' || user?.role === 'am';

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (isManager) {
      try {
        const res = await api.get('/users');
        const staff = res.data.filter(u => ['eos', 'admin', 'helpdesk'].includes(u.role));
        setUsers(staff);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchUsers();
    
    // Auto refresh tiap 1 menit untuk cek SLA
    const interval = setInterval(fetchTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', newTask);
      setIsCreateModalOpen(false);
      setNewTask({ title: '', description: '', assignee_id: '', sla_hours: 12 });
      fetchTasks();
    } catch (err) {
      alert('Gagal membuat task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.put(`/tasks/${taskId}/status`, { status: newStatus });
      fetchTasks();
    } catch (err) {
      alert('Gagal merubah status');
    }
  };

  const openTaskDetail = async (task) => {
    setSelectedTask(task);
    try {
      const res = await api.get(`/tasks/${task.id}/logs`);
      setTaskLogs(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitLog = async (e) => {
    e.preventDefault();
    try {
      let photo_url = null;
      if (newLog.photo) {
        const formData = new FormData();
        formData.append('file', newLog.photo);
        const uploadRes = await api.post('/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        photo_url = uploadRes.data.photo_url;
      }

      await api.post(`/tasks/${selectedTask.id}/logs`, {
        action: newLog.action,
        message: newLog.message,
        photo_url
      });
      
      setNewLog({ message: '', action: 'update_progress', photo: null });
      // Refresh
      openTaskDetail(selectedTask);
      fetchTasks();
    } catch (err) {
      alert('Gagal menambahkan update');
    }
  };

  const [expandedMobileColumn, setExpandedMobileColumn] = useState('todo');

  const renderDesktopBoard = () => {
    return (
      <div className="hidden sm:grid grid-cols-5 gap-4 pb-4 flex-1 min-h-0">
        {COLUMNS.map(column => (
          <div key={column.id} className="flex flex-col glass-card rounded-xl overflow-hidden max-h-full">
            <div className={`${column.color} p-3 flex justify-between items-center shrink-0`}>
              <h3 className="font-semibold text-white">{column.title}</h3>
              <Badge variant="secondary" className="bg-black/20 text-white border-0">
                {tasks.filter(t => t.status === column.id).length}
              </Badge>
            </div>
            
            <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-0">
              {tasks.filter(t => t.status === column.id).map(task => (
                <div 
                  key={task.id}
                  onClick={() => openTaskDetail(task)}
                  className={`bg-slate-800/80 p-4 rounded-lg border cursor-pointer hover:border-blue-500 transition-colors ${task.is_overdue ? 'border-red-500 animate-pulse-slow' : 'border-slate-700'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-white text-sm line-clamp-2 pr-2">{task.title}</h4>
                    {isManager && (
                      <select 
                        onClick={(e) => e.stopPropagation()}
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="bg-slate-900 text-xs text-slate-300 border border-slate-700 rounded p-1 flex-shrink-0"
                      >
                        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400 truncate">{task.assignee_name}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    {task.is_overdue ? (
                      <span className="text-red-400 flex items-center font-medium bg-red-400/10 px-2 py-1 rounded">
                        <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center bg-emerald-400/10 px-2 py-1 rounded">
                        <Clock className="w-3 h-3 mr-1" /> {task.sla_hours}h SLA
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMobileBoard = () => {
    return (
      <div className="flex sm:hidden flex-col gap-3 pb-24 overflow-y-auto flex-1 min-h-0">
        {COLUMNS.map(column => {
          const columnTasks = tasks.filter(t => t.status === column.id);
          const isExpanded = expandedMobileColumn === column.id;
          
          return (
            <div key={column.id} className="glass-card rounded-xl overflow-hidden flex flex-col shrink-0">
              <div 
                className={`${column.color} p-4 flex justify-between items-center cursor-pointer`}
                onClick={() => setExpandedMobileColumn(isExpanded ? null : column.id)}
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-white text-lg">{column.title}</h3>
                  <Badge variant="secondary" className="bg-black/20 text-white border-0">
                    {columnTasks.length}
                  </Badge>
                </div>
                <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  <svg className="w-5 h-5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-3 space-y-3 bg-slate-900/50">
                  {columnTasks.length === 0 ? (
                    <p className="text-center text-slate-500 py-6 text-sm">Belum ada tugas di status ini</p>
                  ) : (
                    columnTasks.map(task => (
                      <div 
                        key={task.id}
                        onClick={() => openTaskDetail(task)}
                        className={`bg-slate-800 p-4 rounded-lg border cursor-pointer hover:border-blue-500 transition-colors shadow-sm ${task.is_overdue ? 'border-red-500 animate-pulse-slow' : 'border-slate-700'}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-white text-sm line-clamp-2 pr-2">{task.title}</h4>
                          {isManager && (
                            <select 
                              onClick={(e) => e.stopPropagation()}
                              value={task.status}
                              onChange={(e) => handleStatusChange(task.id, e.target.value)}
                              className="bg-slate-900 text-xs text-slate-300 border border-slate-700 rounded p-1 flex-shrink-0"
                            >
                              {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mb-3">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-400 truncate">{task.assignee_name}</span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          {task.is_overdue ? (
                            <span className="text-red-400 flex items-center font-medium bg-red-400/10 px-2 py-1 rounded">
                              <AlertCircle className="w-3 h-3 mr-1" /> Overdue
                            </span>
                          ) : (
                            <span className="text-emerald-400 flex items-center bg-emerald-400/10 px-2 py-1 rounded">
                              <Clock className="w-3 h-3 mr-1" /> {task.sla_hours}h SLA
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="animate-fade-in h-full flex flex-col px-2 sm:px-0 relative max-h-screen sm:max-h-full pb-20 sm:pb-0">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mt-2 sm:mt-0 mb-4 sm:mb-6 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center">
            <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-blue-500" />
            Task Management
          </h1>
          <p className="text-xs sm:text-base text-slate-400">Pantau dan kelola penugasan operasional</p>
        </div>
        {isManager && (
          <Button onClick={() => setIsCreateModalOpen(true)} className="btn-primary text-white hidden sm:flex">
            <Plus className="w-4 h-4 mr-2" />
            Buat Task
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {renderDesktopBoard()}
          {renderMobileBoard()}
        </>
      )}

      {/* Mobile FAB for Create Task */}
      {isManager && (
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="sm:hidden fixed bottom-[80px] right-4 w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-600/50 z-40 active:scale-95 transition-transform"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 sm:p-0">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 z-10">
              <h2 className="text-lg font-semibold text-white">Buat Task Baru</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Judul Task</label>
                  <Input 
                    required 
                    value={newTask.title} 
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    className="input-dark w-full text-base sm:text-sm"
                    placeholder="Misal: Pengecekan Router di Site A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Deskripsi</label>
                  <textarea 
                    required
                    value={newTask.description}
                    onChange={e => setNewTask({...newTask, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[100px] text-base sm:text-sm"
                    placeholder="Detail penugasan..."
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Tugaskan Kepada</label>
                    <Select required value={newTask.assignee_id} onValueChange={val => setNewTask({...newTask, assignee_id: val})}>
                      <SelectTrigger className="w-full input-dark text-base sm:text-sm h-11 sm:h-10">
                        <SelectValue placeholder="Pilih Staf" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 z-[70]">
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.full_name || u.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">SLA Waktu (Jam)</label>
                    <Input 
                      type="number"
                      min="1"
                      required
                      value={newTask.sla_hours}
                      onChange={e => setNewTask({...newTask, sla_hours: parseInt(e.target.value)})}
                      className="input-dark w-full text-base sm:text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">Wajib lapor tiap {newTask.sla_hours} jam</p>
                  </div>
                </div>
                <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3 pb-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">Batal</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto order-1 sm:order-2">Buat Task</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Task Detail / Logs Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 sm:p-4">
          <div className="bg-slate-900 border-t sm:border border-slate-700 sm:rounded-xl rounded-t-xl w-full max-w-4xl h-[85vh] sm:h-[90vh] flex flex-col overflow-hidden animate-slide-up sm:animate-none">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex justify-between items-start bg-slate-900 z-10 shrink-0">
              <div className="pr-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white line-clamp-2">{selectedTask.title}</h2>
                  <Badge variant="outline" className="border-blue-500/50 text-blue-400 uppercase text-[10px] sm:text-xs shrink-0">{selectedTask.status.replace('_', ' ')}</Badge>
                </div>
                <p className="text-slate-400 text-xs sm:text-sm">Ditugaskan oleh: {selectedTask.assigner_name} &rarr; {selectedTask.assignee_name}</p>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row pb-safe">
              {/* Kiri: Deskripsi & Form Update */}
              <div className="flex-1 lg:border-r border-b lg:border-b-0 border-slate-800 p-4 sm:p-6 flex flex-col min-h-min shrink-0">
                <div className="bg-slate-950 p-3 sm:p-4 rounded-lg border border-slate-800 mb-6 shrink-0">
                  <h3 className="font-medium text-white mb-2 text-sm sm:text-base">Deskripsi Tugas</h3>
                  <p className="text-slate-300 whitespace-pre-wrap text-xs sm:text-sm">{selectedTask.description}</p>
                </div>
                
                <h3 className="font-medium text-white mb-3 sm:mb-4 text-sm sm:text-base">Update Progress</h3>
                <form onSubmit={handleSubmitLog} className="space-y-3 sm:space-y-4 shrink-0">
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <Button 
                      type="button" 
                      onClick={() => setNewLog({...newLog, action: 'update_progress'})}
                      className={`w-full text-xs sm:text-sm h-10 sm:h-11 ${newLog.action === 'update_progress' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      Update
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => setNewLog({...newLog, action: 'report_blocker'})}
                      className={`w-full text-xs sm:text-sm h-10 sm:h-11 ${newLog.action === 'report_blocker' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      <AlertCircle className="w-4 h-4 sm:mr-2 hidden sm:inline" /> Kendala
                    </Button>
                  </div>
                  
                  <textarea
                    required
                    value={newLog.message}
                    onChange={e => setNewLog({...newLog, message: e.target.value})}
                    placeholder={newLog.action === 'report_blocker' ? "Jelaskan kendala..." : "Jelaskan progress..."}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:border-blue-500 outline-none min-h-[80px] sm:min-h-[100px] text-base sm:text-sm"
                  />
                  
                  <div className="flex items-center gap-2 sm:gap-3">
                    <label className="flex items-center justify-center w-10 h-10 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 text-slate-400 shrink-0">
                      <Paperclip className="w-5 h-5" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={e => setNewLog({...newLog, photo: e.target.files[0]})}
                      />
                    </label>
                    {newLog.photo && <span className="text-xs sm:text-sm text-blue-400 truncate max-w-[100px] sm:max-w-[150px]">{newLog.photo.name}</span>}
                    
                    <Button type="submit" className="ml-auto btn-primary whitespace-nowrap text-xs sm:text-sm h-10 sm:h-11 px-3 sm:px-4">Kirim</Button>
                  </div>
                </form>
              </div>
              
              {/* Kanan: Timeline / Logs */}
              <div className="w-full lg:w-[400px] p-4 sm:p-6 bg-slate-900/50 shrink-0 min-h-[300px]">
                <h3 className="font-medium text-white mb-4 sm:mb-6 text-sm sm:text-base">Riwayat & Update</h3>
                <div className="space-y-4 sm:space-y-6">
                  {taskLogs.map(log => (
                    <div key={log.id} className="relative pl-5 sm:pl-6 border-l-2 border-slate-800">
                      <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-slate-900 ${log.action === 'report_blocker' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                      <div className="mb-1 flex items-start sm:items-center justify-between flex-col sm:flex-row gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm font-medium text-white">{log.user_name}</span>
                        <span className="text-[10px] sm:text-xs text-slate-500">{new Date(log.created_at).toLocaleString('id-ID')}</span>
                      </div>
                      {log.action === 'report_blocker' && (
                        <Badge className="bg-red-500/20 text-red-400 mb-2 border-0 text-[9px] sm:text-[10px] leading-none py-1">KENDALA</Badge>
                      )}
                      <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap">{log.message}</p>
                      {log.photo_url && (
                        <a href={log.photo_url} target="_blank" rel="noreferrer" className="block mt-2 rounded-lg overflow-hidden border border-slate-700 w-fit">
                          <img src={log.photo_url} alt="Eviden" className="h-20 sm:h-24 w-auto object-cover" />
                        </a>
                      )}
                    </div>
                  ))}
                  {taskLogs.length === 0 && <p className="text-slate-500 text-xs sm:text-sm text-center">Belum ada update.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
