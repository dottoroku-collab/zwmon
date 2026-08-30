import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [siteSettings, setSiteSettings] = useState({ site_name: 'Sistem Tiketing & SLA Control Telkom Makassar', site_logo: '' });

  // --- PERBAIKAN 1: UNLOCK AUDIO UNTUK SAFARI ---
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext && !audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }

    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const playZWMONAlert = () => {
    if (!audioCtxRef.current) return;
    const audioCtx = audioCtxRef.current;
    if (audioCtx.state === 'suspended') return;

    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, audioCtx.currentTime); 
    osc1.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); 
    gain1.gain.setValueAtTime(0, audioCtx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.05); 
    gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5); 
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.5);

    setTimeout(() => {
      if (audioCtx.state === 'suspended') return; 
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1046.50, audioCtx.currentTime); 
      gain2.gain.setValueAtTime(0, audioCtx.currentTime);
      gain2.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 0.4);
    }, 150); 
  };

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    const fetchSite = async () => {
      try {
        const res = await axios.get(`${API}/settings/site`);
        setSiteSettings(res.data);
      } catch {}
    };
    fetchSite();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
      } catch (error) {
        logout();
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const response = await axios.post(`${API}/auth/register`, userData);
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const addNotification = useCallback((notification) => {
    const id = Date.now();
    setNotifications(prev => [{ ...notification, id, isRead: false }, ...prev]);
  }, []);

  // --- TAMBAHAN BARU: FUNGSI HAPUS SEMUA NOTIFIKASI ---
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    if (!token || !BACKEND_URL) return;
    
    const connectWS = () => {
      const wsUrl = BACKEND_URL.replace(/^http/, 'ws') + `/ws/${token}`;
      
      try { 
        const ws = new WebSocket(wsUrl);
        ws.onopen = () => console.log('[WS] Connected');
        
        ws.onmessage = (event) => {
          if (event.data === 'pong') return; 

          try { 
            const data = JSON.parse(event.data);
            
            if (data.type === 'ticket_update') {
              playZWMONAlert();
              const eventLabels = {
                ticket_created: 'Tiket baru dibuat',
                ticket_assigned: 'Tiket ditugaskan',
                logbook_updated: 'Logbook diupdate',
                ticket_verified: 'Tiket diverifikasi',
                ticket_rejected: 'Tiket ditolak'
              };
              const label = eventLabels[data.event] || 'Update tiket';
              
              toast.info(`${label}: ${data.ticket_id}`);
              
              // --- TAMBAHAN BARU: LINK KE TIKET ---
              addNotification({ 
                type: 'info', 
                message: `${label}: ${data.ticket_id}`,
                link: `/tickets/${data.ticket_id}` 
              });

              if (Notification.permission === "granted") {
                new Notification("ZWMON Alert!", { body: `${label}: ${data.ticket_id}` });
              }
            } 
            else if (data.type === 'chat_message') {
              playZWMONAlert();
              const senderName = data.from_name || 'Seseorang';
              const chatMsg = data.message || 'Mengirim pesan baru';
              
              toast.success(`Pesan Baru dari ${senderName}`, { description: chatMsg });
              
              // --- TAMBAHAN BARU: LINK KE CHAT ---
              addNotification({ 
                type: 'info', 
                message: `Chat dari ${senderName}`,
                link: `/chat`
              });

              if (Notification.permission === "granted") {
                new Notification("Pesan ZWMON", { body: `${senderName}: ${chatMsg}` });
              }
            }
          } catch (err) { 
            console.error("Gagal memproses pesan WebSocket", err);
          }
        };

        ws.onclose = () => { reconnectRef.current = setTimeout(connectWS, 5000); };
        ws.onerror = () => ws.close();
        wsRef.current = ws;

      } catch (error) { 
        reconnectRef.current = setTimeout(connectWS, 5000);
      }
    };
    
    connectWS();
    
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('ping');
    }, 30000);
    
    return () => {
      clearInterval(pingInterval);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [token, BACKEND_URL, addNotification]); 

  const api = {
    get: (endpoint, config = {}) => axios.get(`${API}${endpoint}`, config),
    post: (endpoint, data, config = {}) => axios.post(`${API}${endpoint}`, data, config),
    put: (endpoint, data, config = {}) => axios.put(`${API}${endpoint}`, data, config),
    delete: (endpoint, config = {}) => axios.delete(`${API}${endpoint}`, config),
    getUsers: () => axios.get(`${API}/users`),
    createUser: (data) => axios.post(`${API}/users`, data),
    updateUser: (id, data) => axios.put(`${API}/users/${id}`, data),
    deleteUser: (id) => axios.delete(`${API}/users/${id}`),
    getEosUsers: () => axios.get(`${API}/users/eos`),
    getMe: () => axios.get(`${API}/auth/me`),
    getTickets: () => axios.get(`${API}/tickets`),
    getTicket: (id) => axios.get(`${API}/tickets/${id}`),
    createTicket: (data) => axios.post(`${API}/tickets`, data),
    updateTicket: (id, data) => axios.put(`${API}/tickets/${id}`, data),
    deleteTicket: (id) => axios.delete(`${API}/tickets/${id}`), 
    assignTicket: (id, eosId) => axios.post(`${API}/tickets/${id}/assign?eos_user_id=${eosId}`),
    verifyTicket: (id, comment) => axios.post(`${API}/tickets/${id}/verify`, { comment: comment || '' }),
    rejectTicket: (id, comment) => axios.post(`${API}/tickets/${id}/reject`, { comment }),
    sendAMMessage: (id, message) => axios.post(`${API}/tickets/${id}/message`, { message }),
    updateProfile: (data) => axios.put(`${API}/auth/profile`, data),
    changePassword: (data) => axios.put(`${API}/auth/password`, data),
    getSiteSettings: () => axios.get(`${API}/settings/site`),
    getMonitoringStatus: () => axios.get(`${API}/monitoring/status`),
    getMonitoringHistory: (spId, hours) => axios.get(`${API}/monitoring/history/${spId}`, { params: { hours } }),
    runPingCheck: () => axios.post(`${API}/monitoring/ping`),
    setPingInterval: (interval) => axios.put(`${API}/monitoring/interval?interval=${interval}`),
    sendChat: (to_user_id, message) => axios.post(`${API}/chat/send`, { to_user_id, message }),
    getConversations: () => axios.get(`${API}/chat/conversations`),
    getChatMessages: (userId) => axios.get(`${API}/chat/messages/${userId}`),
    getChatUsers: () => axios.get(`${API}/chat/users`),
    deleteConversation: (userId) => axios.delete(`${API}/chat/conversations/${userId}`),
    submitLogbook: (data) => axios.post(`${API}/logbook`, data),
    getLogbook: (ticketId) => axios.get(`${API}/logbook/${ticketId}`),
    submitReview: (data) => axios.post(`${API}/review`, data),
    getSettings: () => axios.get(`${API}/settings`),
    updateSettings: (key, value) => axios.post(`${API}/settings`, { key, value }),
    getDashboardStats: (params) => axios.get(`${API}/dashboard/stats`, { params }),
    getDashboardChartData: (params) => axios.get(`${API}/dashboard/chart-data`, { params }),
    getDashboardAnalytics: () => axios.get(`${API}/dashboard/analytics`),
    getSLACompliance: (params) => axios.get(`${API}/sla/compliance`, { params }),
    getTicketReport: (params) => axios.get(`${API}/reports/tickets`, { params }),
    getRestitutionReport: (params) => axios.get(`${API}/reports/restitution`, { params }),
    getDailyRestitution: (days) => axios.get(`${API}/reports/restitution/daily`, { params: { days } }),
    downloadMonthlyPDF: (params) => axios.get(`${API}/reports/monthly-pdf`, { params, responseType: 'blob' }),
    calculateRestitution: (data) => axios.post(`${API}/restitution/calculate`, data),
    getServicePoints: (params) => axios.get(`${API}/service-points`, { params }),
    createServicePoint: (data) => axios.post(`${API}/service-points`, data),
    updateServicePoint: (id, data) => axios.put(`${API}/service-points/${id}`, data),
    deleteServicePoint: (id) => axios.delete(`${API}/service-points/${id}`),
    seedData: () => axios.post(`${API}/seed`),
  };

  const value = {
    user,
    setUser,
    token,
    loading,
    login,
    register,
    logout,
    api,
    notifications,
    addNotification,
    clearNotifications, // <-- Sudah masuk di sini juga Boska
    BACKEND_URL,
    API,
    theme,
    toggleTheme,
    siteSettings,
    setSiteSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;