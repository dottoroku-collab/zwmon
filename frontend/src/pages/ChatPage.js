import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, Users, ArrowLeft, User, Trash2, Mic, Paperclip, Image as ImageIcon, File, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';

const roleLabels = {
  admin: 'Admin', am: 'AM', helpdesk: 'Helpdesk', eos: 'EOS', client: 'Client'
};

const roleBadgeColors = {
  admin: 'bg-rose-500/20 text-rose-400',
  am: 'bg-cyan-500/20 text-cyan-400',
  helpdesk: 'bg-amber-500/20 text-amber-400',
  eos: 'bg-emerald-500/20 text-emerald-400',
  client: 'bg-purple-500/20 text-purple-400'
};

// Web Audio API Context for iOS autoplay bypass
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioContextClass ? new AudioContextClass() : null;
let isAudioUnlocked = false;

function unlockAudio() {
  if (isAudioUnlocked || !audioCtx) return;
  try {
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const node = audioCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(audioCtx.destination);
    node.start(0);
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    isAudioUnlocked = true;
    console.log("AudioContext unlocked");
  } catch (e) {
    console.error("Failed to unlock audio context", e);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });
}

const ChatPage = () => {
  const { user, api } = useApp();
  const [conversations, setConversations] = useState([]);
  const [chatUsers, setChatUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUserList, setShowUserList] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    fetchChatUsers();
    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 30000);

    // Connect WebSocket for PTT
    const token = localStorage.getItem('token');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = process.env.REACT_APP_API_URL 
      ? process.env.REACT_APP_API_URL.replace(/^http/, 'ws') 
      : `${wsProtocol}://${window.location.host}`;
      
    wsRef.current = new WebSocket(`${wsUrl}/ws/${token}`);
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message_global' || data.type === 'chat_message') {
          // You could optimize this, but polling handles the UI update anyway
          fetchMessages(selectedUser?.id || 'global');
        } else if (data.type === 'chat_message_deleted') {
          fetchMessages(selectedUser?.id || 'global');
        } else if (data.type === 'ptt_audio') {
          // Play the audio
          const audioUrl = process.env.REACT_APP_API_URL 
            ? `${process.env.REACT_APP_API_URL}${data.url}` 
            : data.url;
          
          if (audioCtx && isAudioUnlocked) {
            fetch(audioUrl)
              .then(res => res.arrayBuffer())
              .then(buffer => audioCtx.decodeAudioData(buffer))
              .then(decodedData => {
                const source = audioCtx.createBufferSource();
                source.buffer = decodedData;
                source.connect(audioCtx.destination);
                source.start(0);
              })
              .catch(e => {
                console.error("Web Audio API failed", e);
                const audio = new Audio(audioUrl);
                audio.play().catch(err => console.error("Auto-play fallback failed:", err));
              });
          } else {
            const audio = new Audio(audioUrl);
            audio.play().catch(e => console.error("Auto-play failed:", e));
          }
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
      // Poll every 5s
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => fetchMessages(selectedUser.id), 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedUser?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await api.getConversations();
      const globalRoom = {
        conversation_id: 'global',
        other_user_id: 'global',
        other_user_name: 'Global Room',
        other_user_role: 'Semua Orang',
        last_message: 'Ruang obrolan bersama',
        last_message_at: new Date().toISOString(),
        unread_count: 0
      };
      const filtered = (res.data.conversations || []).filter(c => c.conversation_id !== 'global');
      setConversations([globalRoom, ...filtered]);
    } catch { } finally { setLoading(false); }
  };

  const fetchChatUsers = async () => {
    try {
      const res = await api.getChatUsers();
      setChatUsers(res.data.users || []);
    } catch { }
  };

  const fetchOnlineUsers = async () => {
    try {
      const res = await axios.get('/api/admin/who-is-online', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data && res.data.users) {
        setOnlineUsers(res.data.users);
      }
    } catch { }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        const formData = new FormData();
        formData.append('audio_file', audioBlob, `ptt_web_${Date.now()}.webm`);
        
        try {
          await api.post('/ptt/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } catch (e) {
          console.error("Failed to upload PTT:", e);
          toast.error("Gagal mengirim pesan suara");
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Mic access denied or error:", e);
      toast.error("Izin mikrofon diperlukan untuk Walkie-Talkie");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const fetchMessages = async (userId) => {
    try {
      const res = await api.getChatMessages(userId);
      setMessages(res.data.messages || []);
    } catch { }
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !attachment) || !selectedUser) return;
    setSending(true);
    try {
      if (attachment) {
        const formData = new FormData();
        formData.append('to_user_id', selectedUser.id);
        formData.append('message', newMessage.trim());
        formData.append('file', attachment);
        await api.sendChatFile(formData);
      } else {
        await api.sendChat(selectedUser.id, newMessage.trim());
      }
      setNewMessage('');
      removeAttachment();
      fetchMessages(selectedUser.id);
      fetchConversations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 10MB");
      return;
    }

    setAttachment(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setAttachmentPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectConversation = (convo) => {
    setSelectedUser({ id: convo.other_user_id, name: convo.other_user_name, role: convo.other_user_role });
    setShowUserList(false);
  };

  const selectNewUser = (u) => {
    setSelectedUser({ id: u.id, name: u.full_name || u.username, role: u.role });
    setShowUserList(false);
  };

  // --- TAMBAHAN: Fungsi Hapus Chat ---
  const handleDeleteChat = async () => {
    if (!selectedUser) return;
    
    // Munculkan konfirmasi supaya tidak terhapus tidak sengaja
    if (!window.confirm(`Yakin mau menghapus semua percakapan dengan ${selectedUser.name}?`)) {
      return;
    }

    try {
      await api.deleteConversation(selectedUser.id);
      toast.success('Percakapan berhasil dihapus');
      setSelectedUser(null);
      setMessages([]);
      fetchConversations(); // Refresh daftar chat di samping
    } catch (error) {
      toast.error('Gagal menghapus percakapan');
    }
  };

  const handleDeleteGlobalMessage = async (messageId) => {
    if (!window.confirm('Hapus pesan ini dari Global Room?')) return;
    try {
      await api.deleteGlobalChatMessage(messageId);
      toast.success('Pesan dihapus');
      fetchMessages('global');
    } catch (error) {
      toast.error('Gagal menghapus pesan');
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex gap-0 overflow-hidden rounded-xl border border-slate-800 animate-fade-in" data-testid="chat-page">
      {/* Sidebar - Conversations */}
      <div className={`w-80 border-r border-slate-800 bg-slate-900/50 flex flex-col ${selectedUser ? 'hidden md:flex' : 'flex w-full md:w-80'}`}>
        <div className="p-4 border-b border-slate-800 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Live Chat</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserList(!showUserList)}
              className="text-slate-400 hover:text-white"
              title="Mulai Percakapan Baru"
            >
              <Users className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Global PTT Section */}
          <div className="bg-slate-950/50 rounded-xl p-4 flex flex-col items-center gap-3 border border-slate-800">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              onTouchStart={startRecording}
              onTouchEnd={stopRecording}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ${
                isRecording 
                  ? 'bg-rose-600 scale-110 shadow-rose-500/50 ring-4 ring-rose-500/30' 
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105'
              }`}
            >
              {isRecording ? <Mic size={24} className="animate-pulse" /> : <Mic size={24} />}
            </button>
            <div className="flex flex-col items-center text-center">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isRecording ? 'text-rose-500' : 'text-slate-400'}`}>
                {isRecording ? 'Merekam Suara...' : 'Push to Talk'}
              </span>
              <span className="text-[9px] mt-0.5 text-slate-500">
                {isRecording ? 'Lepas untuk mengirim' : 'Tahan untuk berbicara ke semua'}
              </span>
              
              <div className="mt-2 text-[10px] flex items-center gap-1.5 flex-wrap justify-center">
                <span className="flex items-center gap-1 text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {onlineUsers.length} Online:
                </span>
                <span className="text-slate-400 line-clamp-1">
                  {onlineUsers.map(u => u.name.split(' ')[0]).join(', ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {showUserList ? (
            <div className="p-2 space-y-1">
              <p className="text-xs text-slate-500 px-3 py-2">Mulai percakapan baru</p>
              {chatUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectNewUser(u)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{u.full_name || u.username}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${roleBadgeColors[u.role]}`}>{roleLabels[u.role]}</span>
                  </div>
                </button>
              ))}
              {chatUsers.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">Tidak ada user tersedia</p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((convo) => (
                <button
                  key={convo.conversation_id}
                  onClick={() => selectConversation(convo)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    selectedUser?.id === convo.other_user_id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${convo.other_user_id === 'global' ? 'bg-indigo-500/20 border-indigo-500' : 'bg-slate-800 border-slate-700'} flex items-center justify-center border`}>
                    {convo.other_user_id === 'global' ? <Users className="w-5 h-5 text-indigo-400" /> : <User className="w-5 h-5 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white truncate">{convo.other_user_name}</p>
                      {convo.unread_count > 0 && (
                        <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs flex items-center justify-center">{convo.unread_count}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{convo.last_message}</p>
                  </div>
                </button>
              ))}
              {conversations.length === 0 && (
                <div className="text-center py-12 px-4">
                  <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Belum ada percakapan</p>
                  <Button variant="ghost" size="sm" onClick={() => setShowUserList(true)} className="text-rose-400 mt-2">
                    Mulai Chat Baru
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col bg-slate-950/30 ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center p-4 border-b border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUser(null)}
                className="md:hidden text-slate-400 mr-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 mr-3">
                {selectedUser.id === 'global' ? <Users className="w-5 h-5 text-indigo-400" /> : <User className="w-5 h-5 text-slate-500" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{selectedUser.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${roleBadgeColors[selectedUser.role] || 'bg-slate-700 text-slate-300'}`}>
                  {roleLabels[selectedUser.role] || selectedUser.role}
                </span>
              </div>

              {/* --- TAMBAHAN: Tombol Hapus Chat --- */}
              {selectedUser.id !== 'global' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteChat}
                  className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                  title="Hapus Percakapan"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map((msg) => {
                const isMe = msg.from_id === user?.id;
                const isAdminOrAM = user?.role === 'admin' || user?.role === 'am';
                
                let fileUrl = null;
                if (msg.attachment_url) {
                  fileUrl = msg.attachment_url;
                  if (fileUrl.startsWith('/api')) {
                    fileUrl = fileUrl.substring(4);
                  }
                  const backendUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || window.location.origin;
                  fileUrl = `${backendUrl}${fileUrl}`;
                }

                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative group`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isMe ? 'bg-rose-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                    }`}>
                      {!isMe && selectedUser?.id === 'global' && (
                        <p className="text-xs font-semibold text-indigo-300 mb-1">
                          {msg.from_name} <span className="font-normal opacity-70">({roleLabels[msg.from_role] || msg.from_role})</span>
                        </p>
                      )}
                      
                      {fileUrl && (
                        <div className="mb-2">
                          {msg.attachment_type?.startsWith('image/') ? (
                            <img src={fileUrl} alt="Attachment" className="max-w-full rounded-lg max-h-60 object-contain" />
                          ) : (
                            <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm bg-black/20 p-2 rounded-lg hover:bg-black/30 transition">
                              <File size={16} />
                              <span>Lihat File Lampiran</span>
                            </a>
                          )}
                        </div>
                      )}

                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <div className={`text-xs mt-1 flex justify-end items-center gap-2 ${isMe ? 'text-rose-200' : 'text-slate-500'}`}>
                        <span>{formatTime(msg.created_at)}</span>
                        {selectedUser?.id === 'global' && isAdminOrAM && (
                          <button
                            onClick={() => handleDeleteGlobalMessage(msg.id)}
                            className="hover:text-rose-900 transition-colors bg-black/10 p-1 rounded-md"
                            title="Hapus Pesan"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30 flex flex-col gap-2">
              {/* Attachment Preview */}
              {attachment && (
                <div className="flex items-center gap-3 bg-slate-800/80 p-2 rounded-xl w-fit">
                  {attachmentPreview ? (
                    <img src={attachmentPreview} alt="Preview" className="h-12 w-12 object-cover rounded-lg border border-slate-700" />
                  ) : (
                    <div className="h-12 w-12 flex items-center justify-center bg-slate-700 rounded-lg text-slate-400">
                      <File size={20} />
                    </div>
                  )}
                  <div className="flex flex-col max-w-[150px]">
                    <span className="text-sm text-white truncate">{attachment.name}</span>
                    <span className="text-xs text-slate-400">{(attachment.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button onClick={removeAttachment} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition">
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileSelect}
                />
                <Button
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white shrink-0 px-3 h-10"
                  title="Lampirkan File"
                >
                  <Paperclip size={18} />
                </Button>

                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tulis pesan..."
                  className="bg-slate-800/50 border-slate-700 text-white focus:border-rose-500 h-10"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || (!newMessage.trim() && !attachment)}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 h-10"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-500">Pilih percakapan atau mulai chat baru</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;