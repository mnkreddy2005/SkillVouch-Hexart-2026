import React, { useState, useEffect, useRef } from 'react';
import { View, User, Message } from '../types';
import {
  Users,
  BookOpen,
  Map,
  MessageSquare,
  User as UserIcon,
  LogOut,
  Sparkles,
  Send,
  X,
  Phone,
  Video,
  MoreVertical,
  Check,
  CheckCheck
} from 'lucide-react';

interface MessagingPageProps {
  user: User;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  unreadCount: number;
}

interface Conversation {
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  lastMessage?: {
    content: string;
    timestamp: number;
    isFromUser: boolean;
  };
  unreadCount: number;
  lastMessageTime: number;
}

export const MessagingPage: React.FC<MessagingPageProps> = ({
  user,
  onNavigate,
  onLogout,
  unreadCount
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sidebarItems = [
    { view: View.DASHBOARD, icon: Users, label: "Dashboard" },
    { view: View.MY_SKILLS, icon: BookOpen, label: "My Skills" },
    { view: View.FIND_PEERS, icon: Users, label: "Find Peers" },
    { view: View.ROADMAP, icon: Map, label: "Learning Path" },
    { view: View.MESSAGES, icon: MessageSquare, label: "Messages", badge: unreadCount, active: true },
    { view: View.PROFILE, icon: UserIcon, label: "Profile" }
  ];

  useEffect(() => {
    loadConversations();
  }, [user.id]);

  useEffect(() => {
    if (selectedConversation) {
      loadConversation(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      // Mock data - would come from API: GET /api/conversations?userId=${user.id}
      const mockConversations: Conversation[] = [
        {
          partnerId: 'user1',
          partnerName: 'Alex Chen',
          lastMessage: {
            content: 'Hey! I saw you have React skills. Want to exchange?',
            timestamp: Date.now() - 3600000,
            isFromUser: false
          },
          unreadCount: 2,
          lastMessageTime: Date.now() - 3600000
        },
        {
          partnerId: 'user2',
          partnerName: 'Maria Garcia',
          lastMessage: {
            content: 'Thanks for the Python help! Really appreciate it.',
            timestamp: Date.now() - 7200000,
            isFromUser: true
          },
          unreadCount: 0,
          lastMessageTime: Date.now() - 7200000
        },
        {
          partnerId: 'user3',
          partnerName: 'John Smith',
          lastMessage: {
            content: 'When are you free for our next session?',
            timestamp: Date.now() - 86400000,
            isFromUser: false
          },
          unreadCount: 1,
          lastMessageTime: Date.now() - 86400000
        }
      ];

      setConversations(mockConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (partnerId: string) => {
    try {
      // Mock data - would come from API: GET /api/messages/conversation?user1Id=${user.id}&user2Id=${partnerId}
      const mockMessages: Message[] = [
        {
          id: '1',
          senderId: partnerId,
          receiverId: user.id,
          content: 'Hi! I saw your profile and I think we could help each other learn.',
          timestamp: Date.now() - 7200000,
          read: true
        },
        {
          id: '2',
          senderId: user.id,
          receiverId: partnerId,
          content: 'Hey! That sounds great. What skills are you interested in?',
          timestamp: Date.now() - 7000000,
          read: true
        },
        {
          id: '3',
          senderId: partnerId,
          receiverId: user.id,
          content: 'I want to learn React and I can teach you Python. Deal?',
          timestamp: Date.now() - 3600000,
          read: false
        },
        {
          id: '4',
          senderId: partnerId,
          receiverId: user.id,
          content: 'Hey! I saw you have React skills. Want to exchange?',
          timestamp: Date.now() - 3600000,
          read: false
        }
      ];

      setMessages(mockMessages);

      // Mark messages as read - POST /api/messages/mark-as-read
      setConversations(prev => prev.map(conv =>
        conv.partnerId === partnerId ? { ...conv, unreadCount: 0 } : conv
      ));
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // API call: POST /api/messages
      const mockNewMessage: Message = {
        id: Date.now().toString(),
        senderId: user.id,
        receiverId: selectedConversation,
        content: messageContent,
        timestamp: Date.now(),
        read: false
      };

      setMessages(prev => [...prev, mockNewMessage]);

      // Update conversation
      const conversation = conversations.find(c => c.partnerId === selectedConversation);
      if (conversation) {
        setConversations(prev => prev.map(conv =>
          conv.partnerId === selectedConversation
            ? {
                ...conv,
                lastMessage: {
                  content: messageContent,
                  timestamp: Date.now(),
                  isFromUser: true
                },
                lastMessageTime: Date.now()
              }
            : conv
        ));
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      // Re-add message to input if failed
      setNewMessage(messageContent);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const selectedConversationData = conversations.find(c => c.partnerId === selectedConversation);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SkillVouch AI</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {sidebarItems.map((item) => (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                item.active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Conversations List */}
      <aside className={`w-80 bg-slate-900 border-r border-slate-800 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Messages</h2>
          <p className="text-slate-400 text-sm">Connect and exchange skills</p>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No conversations yet</p>
              <p className="text-slate-500 text-sm">Start exchanging skills to begin chatting!</p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <button
                key={conversation.partnerId}
                onClick={() => setSelectedConversation(conversation.partnerId)}
                className={`w-full p-4 border-b border-slate-800 hover:bg-slate-800 transition-colors text-left ${
                  selectedConversation === conversation.partnerId ? 'bg-slate-800' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-slate-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white font-medium truncate">{conversation.partnerName}</p>
                      {conversation.lastMessage && (
                        <span className="text-slate-500 text-xs">
                          {formatTime(conversation.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    {conversation.lastMessage && (
                      <p className={`text-sm truncate ${
                        conversation.unreadCount > 0 && !conversation.lastMessage.isFromUser
                          ? 'text-white font-medium'
                          : 'text-slate-400'
                      }`}>
                        {conversation.lastMessage.isFromUser ? 'You: ' : ''}
                        {conversation.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {conversation.unreadCount > 0 && (
                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat View */}
      <main className={`flex-1 flex flex-col ${selectedConversation ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation && selectedConversationData ? (
          <>
            {/* Chat Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="md:hidden text-slate-400 hover:text-white mr-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">{selectedConversationData.partnerName}</h3>
                    <p className="text-slate-400 text-sm">Online</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800">
                    <Video className="w-5 h-5" />
                  </button>
                  <button className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.senderId === user.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <div className={`flex items-center justify-end mt-1 space-x-1 ${
                      message.senderId === user.id ? 'text-indigo-200' : 'text-slate-400'
                    }`}>
                      <span className="text-xs">{formatTime(message.timestamp)}</span>
                      {message.senderId === user.id && (
                        message.read ? (
                          <CheckCheck className="w-3 h-3" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-6 border-t border-slate-800 bg-slate-900">
              <div className="flex space-x-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                >
                  <Send className="w-5 h-5" />
                  <span>{sending ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-400 mb-2">Select a conversation</h3>
              <p className="text-slate-500">Choose a conversation from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
