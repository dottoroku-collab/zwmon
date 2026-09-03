import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, Ticket, Users, Settings, FileText, Calculator, LogOut, Menu, X, Bell,
  Camera, Server, Megaphone, ChevronRight, MapPin, MessageSquare, User, DollarSign,
  ShieldCheck, Activity, Sun, Moon, Trash2, Video, CheckSquare, Map, ClipboardList
} from 'lucide-react';
import { Button } from './ui/button';

const roleLabels = {
  admin: 'Administrator', am: 'Account Manager', helpdesk: 'Helpdesk', eos: 'EOS Teknisi', client: 'Client'
};

const Layout = ({ children }) => {
  // --- TAMBAHAN: Panggil clearNotifications dari context ---
  const { user, logout, notifications, clearNotifications, theme, toggleTheme, siteSettings } = useApp();
  
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  // Close notif dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'am', 'helpdesk', 'eos', 'client'] },
    { path: '/tasks', icon: CheckSquare, label: 'Task Management', roles: ['admin', 'am', 'helpdesk', 'eos'] },
    { path: '/tickets', icon: Ticket, label: 'Tiket', roles: ['admin', 'am', 'helpdesk', 'eos', 'client'] },
    { path: '/monitoring', icon: Activity, label: 'Pemantauan', roles: ['admin', 'am', 'helpdesk', 'eos'] },
    { path: '/live-map', icon: Map, label: 'Live Map', roles: ['admin', 'am', 'helpdesk'] },
    { path: '/attendance-report', icon: ClipboardList, label: 'Laporan Absensi', roles: ['admin', 'am'] },
    { path: '/daily-reports', icon: FileText, label: 'Laporan Pekerjaan', roles: ['admin', 'am', 'helpdesk', 'eos'] },
    { path: '/live-cctv', icon: Video, label: 'Live CCTV', roles: ['admin', 'am', 'helpdesk', 'eos'] },
    { path: '/chat', icon: MessageSquare, label: 'Live Chat', roles: ['admin', 'am', 'helpdesk', 'eos', 'client'] },
    { path: '/users', icon: Users, label: 'Kelola User', roles: ['admin'] },
    { path: '/service-points', icon: MapPin, label: 'Master Titik', roles: ['admin'] },
    { path: '/restitution', icon: Calculator, label: 'Kalkulator Restitusi', roles: ['admin', 'am'] },
    { path: '/restitution-report', icon: DollarSign, label: 'Laporan Restitusi', roles: ['admin', 'am'] },
    { path: '/sla', icon: ShieldCheck, label: 'SLA Compliance', roles: ['admin', 'am'] },
    { path: '/reports', icon: FileText, label: 'Laporan Tiket', roles: ['admin', 'am', 'helpdesk'] },
    { path: '/settings', icon: Settings, label: 'Pengaturan', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

  const handleLogout = () => { logout(); navigate('/auth'); };

  const siteName = siteSettings?.site_name || 'Telkom Control';
  const siteLogo = siteSettings?.site_logo;

  return (
    <div className={`h-screen overflow-hidden flex ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-950'}`}>
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex lg:flex-col lg:w-64 border-r ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/10'}`}>
        {/* Logo */}
        <div className={`p-6 border-b ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-3">
            {siteLogo ? (
              <img src={siteLogo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1 shadow-sm">
                <img src="/logo.png" alt="Logo ZWMON" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className={`font-bold text-sm truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{siteName}</h1>
              <p className="text-xs text-slate-400">Makassar</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
              (item.path === '/tickets' && location.pathname.startsWith('/tickets'));
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.path.replace('/', '')}`}
                className={`sidebar-item flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-rose-500/10 text-rose-400 border-l-2 border-rose-500' 
                    : theme === 'light' ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className={`p-4 border-t ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
          <div className={`rounded-lg p-4 ${theme === 'light' ? 'bg-slate-100' : 'glass-card'}`}>
            <Link to="/profile" className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity" data-testid="nav-profile">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <span className="text-cyan-400 font-semibold text-sm">
                  {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {user?.full_name || user?.username}
                </p>
                <p className="text-xs text-slate-400">{roleLabels[user?.role]}</p>
              </div>
            </Link>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />Keluar
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className={`absolute left-0 top-0 bottom-0 w-72 flex flex-col animate-fade-in ${theme === 'light' ? 'bg-white' : 'bg-slate-900'} border-r ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
            <div className={`p-6 border-b flex items-center justify-between shrink-0 ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="flex items-center gap-3">
                {siteLogo ? (
                  <img src={siteLogo} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1 shadow-sm">
                    <img src="/logo.png" alt="Logo ZWMON" className="w-full h-full object-contain" />
                  </div>
                )}
                <h1 className={`font-bold text-sm ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{siteName}</h1>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-1" style={{ scrollbarWidth: 'none' }}>
              {filteredMenuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-rose-500/10 text-rose-400' : theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                    }`}
                  ><Icon className="w-5 h-5" />{item.label}</Link>
                );
              })}
            </nav>
            <div className={`p-4 border-t shrink-0 ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
              <Button onClick={handleLogout} variant="ghost" className="w-full justify-start text-slate-400 hover:text-rose-400">
                <LogOut className="w-4 h-4 mr-2" />Keluar
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className={`sticky top-0 z-40 backdrop-blur-xl border-b ${theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-950/80 border-white/10'}`}>
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white" data-testid="mobile-menu-btn">
                <Menu className="w-6 h-6" />
              </button>
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="text-slate-500">{siteName}</span>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className={`font-medium ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  {filteredMenuItems.find(item => location.pathname === item.path || (item.path === '/tickets' && location.pathname.startsWith('/tickets')))?.label || 'Dashboard'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button onClick={toggleTheme} className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-amber-500 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} data-testid="theme-toggle">
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* Notifications */}
              <div className="relative" ref={notifRef}>
                <button onClick={() => setNotifOpen(!notifOpen)} className={`relative p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} data-testid="notifications-btn">
                  <Bell className="w-5 h-5" />
                  {notifications.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>}
                </button>
                
                {notifOpen && (
                  <div className={`absolute right-0 top-12 w-80 rounded-xl shadow-2xl border z-50 overflow-hidden ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`} data-testid="notifications-dropdown">
                    
                    {/* --- HEADER LONCENG --- */}
                    <div className={`p-3 border-b flex justify-between items-center ${theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-700 bg-slate-800/80'}`}>
                      <h3 className={`font-semibold text-sm ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Notifikasi</h3>
                      {notifications.length > 0 && (
                        <button 
                          onClick={() => { clearNotifications(); setNotifOpen(false); }} 
                          className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-400 font-medium transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus Semua
                        </button>
                      )}
                    </div>

                    {/* --- ISI LONCENG --- */}
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? notifications.map((n) => (
                        <div key={n.id} className={`border-b last:border-0 transition-colors ${theme === 'light' ? 'border-slate-100 hover:bg-slate-50' : 'border-slate-700/50 hover:bg-slate-800/50'}`}>
                          {n.link ? (
                            <Link 
                              to={n.link} 
                              onClick={() => setNotifOpen(false)}
                              className="block p-3.5"
                            >
                              <p className={`text-sm ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{n.message}</p>
                              <p className="text-[10px] text-cyan-500 font-medium mt-1">Klik untuk lihat detail &rarr;</p>
                            </Link>
                          ) : (
                            <div className="block p-3.5">
                              <p className={`text-sm ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>{n.message}</p>
                            </div>
                          )}
                        </div>
                      )) : (
                        <div className="p-6 text-center text-slate-500 text-sm">Tidak ada notifikasi baru</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Avatar - Mobile */}
              <Link to="/profile" className="lg:hidden">
                <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <span className="text-cyan-400 font-semibold text-xs">{user?.full_name?.charAt(0) || 'U'}</span>
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={`flex-1 p-4 lg:p-8 overflow-y-auto min-h-0 ${theme === 'light' ? 'bg-slate-50' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;