import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';
import { MessageSquare, Send, Loader2, Users, ArrowLeft, User, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    fetchChatUsers();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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
      setConversations(res.data.conversations || []);
    } catch { } finally { setLoading(false); }
  };

  const fetchChatUsers = async () => {
    try {
      const res = await api.getChatUsers();
      setChatUsers(res.data.users || []);
    } catch { }
  };

  const fetchMessages = async (userId) => {
    try {
      const res = await api.getChatMessages(userId);
      setMessages(res.data.messages || []);
    } catch { }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedUser) return;
    setSending(true);
    try {
      await api.sendChat(selectedUser.id, newMessage.trim());
      setNewMessage('');
      fetchMessages(selectedUser.id);
      fetchConversations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
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
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Chat</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserList(!showUserList)}
              className="text-slate-400 hover:text-white"
              data-testid="new-chat-btn"
            >
              <Users className="w-4 h-4" />
            </Button>
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
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <User className="w-5 h-5 text-slate-500" />
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
                <User className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{selectedUser.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${roleBadgeColors[selectedUser.role]}`}>
                  {roleLabels[selectedUser.role]}
                </span>
              </div>

              {/* --- TAMBAHAN: Tombol Hapus Chat --- */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteChat}
                className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                title="Hapus Percakapan"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map((msg) => {
                const isMe = msg.from_id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isMe ? 'bg-rose-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isMe ? 'text-rose-200' : 'text-slate-500'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/30">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tulis pesan..."
                  className="bg-slate-800/50 border-slate-700 text-white focus:border-rose-500"
                />
                <Button
                  onClick={handleSend}
                  disabled={sending || !newMessage.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4"
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