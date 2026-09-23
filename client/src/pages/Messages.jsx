import React, { useEffect, useState, useRef, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { MessageSquare, Send, User, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

export default function Messages() {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);

  // Initialize socket and fetch active ride match conversations
  useEffect(() => {
    const s = io('http://localhost:5000');
    setSocket(s);

    s.on('chatMessage', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Check for matched/accepted rides to unlock chat
    const fetchActiveMatches = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/rides/requests/my');
        const acceptedIncoming = (res.data.incoming || []).filter(r => r.status === 'accepted');
        const acceptedOutgoing = (res.data.outgoing || []).filter(r => r.status === 'accepted');

        const activeList = [
          ...acceptedIncoming.map(r => ({
            id: r._id,
            rideId: r.ride?._id || r.ride,
            partnerName: r.requester?.name || 'Rider Student',
            partnerUSN: r.requester?.usn || '',
            route: `${r.ride?.originAddress || 'Pickup'} → BITM`,
            role: 'Passenger'
          })),
          ...acceptedOutgoing.map(r => ({
            id: r._id,
            rideId: r.ride?._id || r.ride,
            partnerName: r.ride?.offeredBy?.name || 'Driver Student',
            partnerUSN: r.ride?.offeredBy?.usn || '',
            route: `${r.ride?.originAddress || 'Pickup'} → BITM`,
            role: 'Ride Provider'
          }))
        ];

        setConversations(activeList);
      } catch (e) {
        // silent fail
      }
    };

    fetchActiveMatches();

    return () => s.close();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    const msg = {
      text: input,
      sender: user?.name || 'Me',
      timestamp: new Date(),
      conversationId: selectedConversation?.id
    };
    socket.emit('chatMessage', msg);
    setMessages(prev => [...prev, msg]);
    setInput('');
  };

  return (
    <div className="bg-white rounded-[24px] border border-gray-100 shadow-xs overflow-hidden min-h-[520px] flex flex-col md:flex-row">
      {/* Left Column: Conversations */}
      <div className="w-full md:w-80 border-r border-gray-100 flex flex-col bg-white">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Conversations</h2>
        </div>

        <div className="flex-1 p-6">
          {conversations.length === 0 ? (
            /* Empty state matching Screenshot 3 */
            <p className="text-gray-400 text-sm leading-relaxed">
              No active ride conversations. Accept a ride request to unlock live 1-on-1 chat!
            </p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`p-3.5 rounded-2xl cursor-pointer transition border ${
                    selectedConversation?.id === conv.id
                      ? 'bg-[#eaf7f2] border-[#daf1e8] text-gray-900'
                      : 'bg-white hover:bg-gray-50 border-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#00b87c] text-white flex items-center justify-center font-bold text-xs">
                      {conv.partnerName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-gray-900">{conv.partnerName}</p>
                      <p className="text-xs text-gray-400 truncate">{conv.route}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Chat Window or Empty State */}
      <div className="flex-1 flex flex-col min-h-[460px] bg-white">
        {selectedConversation ? (
          /* Active Chat Conversation */
          <div className="flex-1 flex flex-col h-full">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-[#fbfdfc]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#00b87c] text-white flex items-center justify-center font-bold text-sm">
                  {selectedConversation.partnerName[0]}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{selectedConversation.partnerName}</h3>
                  <p className="text-xs text-[#00a86b] font-medium">Verified BITM Student ({selectedConversation.partnerUSN})</p>
                </div>
              </div>
              <div className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full font-medium">
                Live Ride Chat
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#fbfdfc]/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs">
                  Say hi to coordinate your pickup spot!
                </div>
              ) : (
                messages.map((m, i) => {
                  const isMe = m.sender === 'Me' || m.sender === user?.name;
                  return (
                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-[#00b87c] text-white rounded-br-xs'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-xs shadow-xs'
                        }`}
                      >
                        <p>{m.text}</p>
                        <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/80' : 'text-gray-400'}`}>
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 flex items-center gap-2 bg-white">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-5 py-3 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-[#00b87c] focus:ring-1 focus:ring-[#00b87c]"
              />
              <button
                type="submit"
                className="w-11 h-11 rounded-full bg-[#00b87c] hover:bg-[#00a36e] text-white flex items-center justify-center shadow-xs transition shrink-0"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </form>
          </div>
        ) : (
          /* Empty State matching Screenshot 3 */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-full text-center pb-8">
              <p className="text-gray-400 text-sm">Select a conversation to start chatting</p>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center -mt-8">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3 text-[#94a3b8]">
                <MessageSquare className="w-16 h-16 stroke-[1.3]" />
              </div>
              <p className="text-gray-500 text-sm text-center max-w-sm leading-relaxed">
                Your messages with other matched BITM commuters will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
