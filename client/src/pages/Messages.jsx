import React, { useEffect, useState, useRef, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { MessageSquare, Send, User, CheckCircle2, Trash2, Clock, Check, AlertCircle, Sparkles, Filter } from 'lucide-react';
import axios from 'axios';
import { format12Hour } from '../utils/timeFormat';

export default function Messages() {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'COMPLETED'
  const [loading, setLoading] = useState(true);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null); // conv object to delete
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const chatEndRef = useRef(null);

  // Helper to get auth header
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 1. Fetch conversations & deleted conversations list
  const fetchConversations = async () => {
    try {
      const [ridesRes, deletedRes] = await Promise.all([
        axios.get('http://localhost:5000/api/rides/requests/my', { headers: getAuthHeaders() }),
        axios.get('http://localhost:5000/api/messages/deleted-conversations', { headers: getAuthHeaders() }).catch(() => ({ data: [] }))
      ]);

      const deletedIds = new Set(deletedRes.data || []);

      // Get local cached deleted IDs as a fallback safeguard
      try {
        const localDeleted = JSON.parse(localStorage.getItem(`bikemate_deleted_chats_${user?._id}`) || '[]');
        localDeleted.forEach(id => deletedIds.add(id));
      } catch (e) {}

      const acceptedIncoming = (ridesRes.data.incoming || []).filter(r => r.status === 'accepted' || r.status === 'repeat_requested');
      const acceptedOutgoing = (ridesRes.data.outgoing || []).filter(r => r.status === 'accepted' || r.status === 'repeat_requested');

      const allList = [
        ...acceptedIncoming.map(r => {
          const isCompleted = r.ride?.status === 'completed';
          return {
            id: r._id,
            rideId: r.ride?._id || r.ride,
            partnerId: r.requester?._id,
            partnerName: r.requester?.name || 'Rider Student',
            partnerUSN: r.requester?.usn || '',
            route: `${r.ride?.originAddress || 'Pickup'} → BITM`,
            role: 'Passenger (Commuter)',
            isCompleted,
            status: isCompleted ? 'completed' : (r.ride?.status || 'active'),
            createdAt: r.createdAt
          };
        }),
        ...acceptedOutgoing.map(r => {
          const isCompleted = r.ride?.status === 'completed';
          return {
            id: r._id,
            rideId: r.ride?._id || r.ride,
            partnerId: r.driver?._id || r.ride?.offeredBy?._id,
            partnerName: r.driver?.name || r.ride?.offeredBy?.name || 'Driver Student',
            partnerUSN: r.driver?.usn || r.ride?.offeredBy?.usn || '',
            route: `${r.ride?.originAddress || 'Pickup'} → BITM`,
            role: 'Ride Provider (Driver)',
            isCompleted,
            status: isCompleted ? 'completed' : (r.ride?.status || 'active'),
            createdAt: r.createdAt
          };
        })
      ];

      // Filter out conversations that the user has chosen to delete
      const visibleList = allList.filter(conv => !deletedIds.has(conv.id));
      setConversations(visibleList);

      // If currently selected conversation was deleted, deselect it
      if (selectedConversation && deletedIds.has(selectedConversation.id)) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (e) {
      console.warn('Error fetching conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch messages for the selected conversation
  const fetchMessagesForConversation = async (convId) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/messages/${convId}`, {
        headers: getAuthHeaders()
      });
      setMessages(res.data || []);
    } catch (e) {
      console.warn('Error fetching messages from server, using local list:', e);
    }
  };

  // Initialize socket and load conversations
  useEffect(() => {
    const s = io('http://localhost:5000');
    setSocket(s);

    s.on('chatMessage', (msg) => {
      // If message belongs to currently open conversation, append it
      if (msg.conversationId === selectedConversation?.id) {
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m._id === msg._id || (m.text === msg.text && Math.abs(new Date(m.timestamp) - new Date(msg.timestamp)) < 1500))) {
            return prev;
          }
          return [...prev, {
            _id: msg._id || 'msg_' + Date.now(),
            text: msg.text,
            sender: msg.sender,
            senderId: msg.senderId,
            isMe: msg.senderId === user?._id || msg.sender === user?.name || msg.sender === 'Me',
            timestamp: msg.timestamp || new Date(),
            conversationId: msg.conversationId
          }];
        });
      }
    });

    s.on('messageDeleted', (data) => {
      if (data.conversationId === selectedConversation?.id) {
        setMessages(prev => prev.filter(m => m._id !== data.messageId));
      }
    });

    s.on('conversationDeleted', (data) => {
      if (data.deletedByUserId === user?._id) {
        setConversations(prev => prev.filter(c => c.id !== data.conversationId));
        if (selectedConversation?.id === data.conversationId) {
          setSelectedConversation(null);
          setMessages([]);
        }
      }
    });

    fetchConversations();

    return () => s.close();
  }, [user?._id, selectedConversation?.id]);

  // When selected conversation changes, load its messages
  useEffect(() => {
    if (selectedConversation?.id) {
      fetchMessagesForConversation(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Send message handler
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedConversation) return;

    const messageText = input.trim();
    setInput('');

    // Optimistic UI append
    const tempMsg = {
      _id: 'temp_' + Date.now(),
      text: messageText,
      sender: user?.name || 'Me',
      senderId: user?._id,
      isMe: true,
      timestamp: new Date(),
      conversationId: selectedConversation.id
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await axios.post('http://localhost:5000/api/messages', {
        conversationId: selectedConversation.id,
        rideId: selectedConversation.rideId,
        text: messageText,
        receiverId: selectedConversation.partnerId
      }, { headers: getAuthHeaders() });

      // Update optimistic message with real DB ID
      if (res.data?._id) {
        setMessages(prev => prev.map(m => m._id === tempMsg._id ? { ...m, _id: res.data._id } : m));
      }
    } catch (err) {
      console.warn('Backend message save fallback to socket:', err.message);
      if (socket) {
        socket.emit('chatMessage', tempMsg);
      }
    }
  };

  // 4. Delete an individual message
  const handleDeleteMessage = async (messageId) => {
    try {
      // Optimistic delete
      setMessages(prev => prev.filter(m => m._id !== messageId));

      await axios.delete(`http://localhost:5000/api/messages/${messageId}`, {
        headers: getAuthHeaders()
      }).catch(() => {});

      if (socket) {
        socket.emit('deleteMessage', { messageId, conversationId: selectedConversation?.id });
      }
    } catch (e) {
      console.error('Error deleting message:', e);
    }
  };

  // 5. Delete an entire conversation
  const handleDeleteConversation = async (conv) => {
    if (!conv) return;

    try {
      // 1. Immediately remove from local view
      setConversations(prev => prev.filter(c => c.id !== conv.id));
      if (selectedConversation?.id === conv.id) {
        setSelectedConversation(null);
        setMessages([]);
      }
      setDeleteConfirmTarget(null);

      // 2. Cache in localStorage so it never comes back for this user
      try {
        const localKey = `bikemate_deleted_chats_${user?._id}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        if (!existing.includes(conv.id)) {
          existing.push(conv.id);
          localStorage.setItem(localKey, JSON.stringify(existing));
        }
      } catch (e) {}

      // 3. Persist to MongoDB backend
      await axios.delete(`http://localhost:5000/api/messages/conversation/${conv.id}`, {
        headers: getAuthHeaders()
      }).catch(err => console.warn('Server deleteConversation notice:', err.message));

      if (socket) {
        socket.emit('deleteConversation', { conversationId: conv.id, deletedByUserId: user?._id });
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    }
  };

  // 6. Bulk Delete all completed rides when many accumulate
  const handleBulkDeleteCompleted = async () => {
    const completedConvs = conversations.filter(c => c.isCompleted);
    if (completedConvs.length === 0) return;

    if (!window.confirm(`Clear all ${completedConvs.length} completed ride chats from your list? You can always start new chats for upcoming rides.`)) {
      return;
    }

    setBulkDeleting(true);
    const completedIds = completedConvs.map(c => c.id);

    try {
      // Remove from state
      setConversations(prev => prev.filter(c => !c.isCompleted));
      if (selectedConversation && completedIds.includes(selectedConversation.id)) {
        setSelectedConversation(null);
        setMessages([]);
      }

      // Cache locally
      try {
        const localKey = `bikemate_deleted_chats_${user?._id}`;
        const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
        const updated = Array.from(new Set([...existing, ...completedIds]));
        localStorage.setItem(localKey, JSON.stringify(updated));
      } catch (e) {}

      // Bulk delete on backend
      await axios.post('http://localhost:5000/api/messages/bulk-delete', {
        conversationIds: completedIds
      }, { headers: getAuthHeaders() }).catch(() => {});
    } finally {
      setBulkDeleting(false);
    }
  };

  // Filtered conversations list based on active tab
  const filteredConversations = conversations.filter(conv => {
    if (filterTab === 'ACTIVE') return !conv.isCompleted;
    if (filterTab === 'COMPLETED') return conv.isCompleted;
    return true;
  });

  const activeCount = conversations.filter(c => !c.isCompleted).length;
  const completedCount = conversations.filter(c => c.isCompleted).length;

  return (
    <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden h-[calc(100vh-140px)] min-h-[560px] flex flex-col md:flex-row relative">
      
      {/* ================= LEFT COLUMN: CONVERSATIONS LIST ================= */}
      <div className="w-full md:w-80 lg:w-96 border-r border-gray-100 flex flex-col bg-white shrink-0 h-full">
        
        {/* Header with Title & Filter Tabs */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
                <span>Messages</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#00b87c] border border-emerald-200">
                  {conversations.length}
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">Direct Commuter & Driver Coordination</p>
            </div>
            
            {/* Quick Bulk Delete if completed rides exist */}
            {completedCount > 0 && (
              <button
                type="button"
                onClick={handleBulkDeleteCompleted}
                disabled={bulkDeleting}
                title="Delete all finished ride chats"
                className="text-[11px] font-bold text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 px-2.5 py-1.5 rounded-xl border border-gray-200 hover:border-red-200 transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear {completedCount} Done</span>
              </button>
            )}
          </div>

          {/* Filter Tabs: All, Active, Completed */}
          <div className="flex items-center bg-gray-100/80 p-1 rounded-xl text-xs font-semibold gap-1">
            <button
              onClick={() => setFilterTab('ALL')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                filterTab === 'ALL'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              All ({conversations.length})
            </button>
            <button
              onClick={() => setFilterTab('ACTIVE')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                filterTab === 'ACTIVE'
                  ? 'bg-[#00b87c] text-white shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilterTab('COMPLETED')}
              className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                filterTab === 'COMPLETED'
                  ? 'bg-gray-800 text-white shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Past ({completedCount})
            </button>
          </div>
        </div>

        {/* Conversation Cards List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-gray-400 text-xs">
              <span className="animate-spin mr-2">⏳</span> Loading chats...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs leading-relaxed space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 mx-auto flex items-center justify-center text-gray-400">
                <MessageSquare className="w-6 h-6 stroke-[1.6]" />
              </div>
              <p className="font-bold text-gray-700">No chats in this view</p>
              <p className="text-[11px] text-gray-400 max-w-[220px] mx-auto">
                {filterTab === 'COMPLETED'
                  ? 'Past ride chats appear here once rides finish.'
                  : 'Connect with a commuter or driver to start coordinating.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`group relative p-3 rounded-2xl cursor-pointer transition border ${
                    isSelected
                      ? 'bg-emerald-50/80 border-emerald-300 text-gray-900 shadow-2xs'
                      : 'bg-white hover:bg-gray-50/90 border-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar with initial */}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00b87c] to-[#009665] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {conv.partnerName[0] || 'S'}
                    </div>

                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-sm font-bold truncate text-gray-900">{conv.partnerName}</p>
                      </div>

                      <p className="text-[11px] text-gray-500 truncate mb-1">
                        {conv.route}
                      </p>

                      {/* Status Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {conv.isCompleted ? (
                          <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold border border-gray-200 flex items-center gap-1">
                            <span>🏁 Completed</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[#00a86b] text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00b87c] animate-pulse" />
                            <span>Active</span>
                          </span>
                        )}

                        <span className="text-[10px] text-gray-400 font-medium truncate">
                          • {conv.role.split(' ')[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Delete Chat Trash Button on Card */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmTarget(conv);
                    }}
                    title="Delete this chat"
                    className="absolute top-3.5 right-3 w-7 h-7 rounded-lg bg-gray-100/60 hover:bg-red-50 text-gray-400 hover:text-red-600 flex items-center justify-center transition border border-transparent hover:border-red-200 opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= RIGHT COLUMN: CHAT WINDOW OR EMPTY STATE ================= */}
      <div className="flex-1 flex flex-col h-full bg-[#f8faf9] overflow-hidden">
        {selectedConversation ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* Chat Top Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-white shadow-2xs shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-[#00b87c] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {selectedConversation.partnerName[0] || 'S'}
                  </div>
                  {!selectedConversation.isCompleted && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00b87c] border-2 border-white" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-extrabold text-gray-900">{selectedConversation.partnerName}</h3>
                    {selectedConversation.isCompleted ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                        🏁 Completed
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#00a86b] border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00b87c] animate-pulse" />
                        <span>Active Ride</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {selectedConversation.role} {selectedConversation.partnerUSN ? `• ${selectedConversation.partnerUSN}` : ''} • {selectedConversation.route}
                  </p>
                </div>
              </div>

              {/* Chat Header Actions: Delete Chat Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(selectedConversation)}
                  className="px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 text-xs font-bold transition flex items-center gap-1.5 border border-gray-200 hover:border-red-200 cursor-pointer"
                  title="Delete chat from history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete Chat</span>
                </button>
              </div>
            </div>

            {/* Subtle notice if ride is completed */}
            {selectedConversation.isCompleted && (
              <div className="px-4 py-2 bg-gray-100/80 border-b border-gray-200/60 text-gray-600 text-[11px] font-medium flex items-center justify-between shrink-0">
                <span>🏁 Commute completed. Conversation is kept for your records.</span>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(selectedConversation)}
                  className="text-red-600 font-bold hover:underline cursor-pointer ml-2"
                >
                  Delete Chat
                </button>
              </div>
            )}

            {/* Chat Messages List (WhatsApp/Telegram style) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#f8faf9]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs space-y-1.5 py-12">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#00b87c] flex items-center justify-center mb-1">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-gray-800 text-sm">Start the conversation</p>
                  <p className="text-gray-400 text-center max-w-xs">
                    Coordinate pickup spot, landmark, or arrival updates with {selectedConversation.partnerName}.
                  </p>
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.isMe || m.sender === 'Me' || m.sender === user?.name || m.senderId === user?._id;
                  return (
                    <div
                      key={m._id || i}
                      className={`group flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Delete individual message button for sender */}
                      {isMe && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(m._id)}
                          title="Delete message for me"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition text-[10px] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div
                        className={`max-w-[78%] sm:max-w-[65%] px-4 py-2.5 rounded-2xl text-sm relative shadow-2xs leading-relaxed ${
                          isMe
                            ? 'bg-[#00b87c] text-white rounded-br-xs'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-xs'
                        }`}
                      >
                        <p className="break-words">{m.text}</p>
                        <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMe ? 'text-white/80' : 'text-gray-400'}`}>
                          <span>
                            {m.timestamp ? format12Hour(m.timestamp) : ''}
                          </span>
                          {isMe && <Check className="w-3 h-3 text-white/90" />}
                        </div>
                      </div>

                      {/* Delete message button for receiver (delete for me) */}
                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(m._id)}
                          title="Delete message for me"
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition text-[10px] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Box */}
            <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t border-gray-100 flex items-center gap-2.5 bg-white shrink-0">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message to coordinate your ride..."
                className="flex-1 px-5 py-3 rounded-full bg-gray-100 border border-transparent focus:border-[#00b87c] focus:bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00b87c] transition"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-11 h-11 rounded-full bg-[#00b87c] hover:bg-[#00a36e] disabled:opacity-40 text-white flex items-center justify-center shadow-md transition shrink-0 cursor-pointer"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </form>

          </div>
        ) : (
          /* Empty State when no conversation is selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/40">
            <div className="w-20 h-20 rounded-3xl bg-white border border-gray-100 shadow-xs flex items-center justify-center mb-4 text-[#00b87c]">
              <MessageSquare className="w-10 h-10 stroke-[1.6]" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Select a conversation to start chatting</h3>
            <p className="text-gray-500 text-xs text-center max-w-sm leading-relaxed mb-4">
              Coordinate pickup spots, routes, and departure times with fellow BITM student commuters and drivers.
            </p>
            <div className="text-[11px] text-gray-400 bg-white px-3.5 py-1.5 rounded-full border border-gray-200 flex items-center gap-1.5">
              <span>💡</span>
              <span>You can delete completed chats anytime once rides are over.</span>
            </div>
          </div>
        )}
      </div>

      {/* ================= DELETE CHAT CONFIRMATION MODAL ================= */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[24px] max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900">Delete Conversation?</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Delete chat with <strong className="text-gray-800">{deleteConfirmTarget.partnerName}</strong> ({deleteConfirmTarget.route})?
              </p>
              <div className="p-3 bg-gray-50 rounded-xl text-left text-xs text-gray-600 border border-gray-100 mt-3 space-y-1">
                <p>• <strong>Your choice:</strong> Deleting clears this chat from your view.</p>
                <p>• <strong>Independent:</strong> The other student can still keep their copy as long as they want.</p>
                {deleteConfirmTarget.isCompleted && (
                  <p className="text-emerald-700 font-semibold">• This ride is already finished.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="flex-1 py-3 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-xs transition"
              >
                Keep Chat
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConversation(deleteConfirmTarget)}
                className="flex-1 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition"
              >
                Delete Chat 🗑️
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
