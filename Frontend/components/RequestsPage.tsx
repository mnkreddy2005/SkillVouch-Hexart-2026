import React, { useState, useEffect } from 'react';
import { View, User, ExchangeRequest } from '../types';
import {
  Users,
  BookOpen,
  Map,
  MessageSquare,
  User as UserIcon,
  LogOut,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  UserCheck,
  UserX
} from 'lucide-react';

interface RequestsPageProps {
  user: User;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  unreadCount: number;
}

type RequestTab = 'received' | 'sent';

export const RequestsPage: React.FC<RequestsPageProps> = ({
  user,
  onNavigate,
  onLogout,
  unreadCount
}) => {
  const [activeTab, setActiveTab] = useState<RequestTab>('received');
  const [requests, setRequests] = useState<ExchangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const sidebarItems = [
    { view: View.DASHBOARD, icon: Users, label: "Dashboard" },
    { view: View.MY_SKILLS, icon: BookOpen, label: "My Skills" },
    { view: View.FIND_PEERS, icon: Users, label: "Find Peers" },
    { view: View.ROADMAP, icon: Map, label: "Learning Path" },
    { view: View.MESSAGES, icon: MessageSquare, label: "Messages", badge: unreadCount },
    { view: View.PROFILE, icon: UserIcon, label: "Profile" }
  ];

  useEffect(() => {
    loadRequests();
  }, [user.id]);

  const loadRequests = async () => {
    try {
      // Mock data - would come from API: GET /api/requests?userId=${user.id}
      const mockRequests: ExchangeRequest[] = [
        {
          id: '1',
          requesterId: 'user123',
          targetId: user.id,
          skillToTeach: 'React',
          skillToLearn: 'Python',
          message: 'I can help you learn React in exchange for Python tutoring.',
          status: 'pending',
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: '2',
          requesterId: user.id,
          targetId: 'user456',
          skillToTeach: 'JavaScript',
          skillToLearn: 'UI/UX Design',
          message: 'Looking to improve my design skills!',
          status: 'accepted',
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-12')
        },
        {
          id: '3',
          requesterId: user.id,
          targetId: 'user789',
          skillToTeach: 'Node.js',
          skillToLearn: 'Machine Learning',
          message: 'Want to learn ML, can teach backend development.',
          status: 'completed',
          createdAt: new Date('2024-01-05'),
          updatedAt: new Date('2024-01-20')
        }
      ];

      // Sort by created_at DESC
      mockRequests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRequests(mockRequests);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    setProcessingId(requestId);
    try {
      // API call: PUT /api/requests/${requestId}/status
      // Mock update for now
      setRequests(prev => prev.map(req =>
        req.id === requestId
          ? { ...req, status: newStatus as any, updatedAt: new Date() }
          : req
      ));
    } catch (error) {
      console.error('Failed to update request status:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getFilteredRequests = () => {
    if (activeTab === 'received') {
      return requests.filter(req => req.targetId === user.id);
    } else {
      return requests.filter(req => req.requesterId === user.id);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'accepted':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'declined':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-blue-400" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-900/20 border-yellow-700 text-yellow-300';
      case 'accepted':
        return 'bg-green-900/20 border-green-700 text-green-300';
      case 'declined':
        return 'bg-red-900/20 border-red-700 text-red-300';
      case 'completed':
        return 'bg-blue-900/20 border-blue-700 text-blue-300';
      default:
        return 'bg-slate-900/20 border-slate-700 text-slate-300';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading requests...</div>
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
                item.view === View.REQUESTS
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

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Skill Exchange Requests</h1>
            <p className="text-slate-400">Connect with peers for mutual skill development.</p>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 mb-6 bg-slate-800/50 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('received')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'received'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Received ({requests.filter(r => r.targetId === user.id).length})
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              Sent ({requests.filter(r => r.requesterId === user.id).length})
            </button>
          </div>

          {/* Requests List */}
          <div className="space-y-4">
            {getFilteredRequests().length === 0 ? (
              <div className="text-center py-12">
                <Send className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-400 mb-2">
                  No {activeTab} requests
                </h3>
                <p className="text-slate-500">
                  {activeTab === 'received'
                    ? "You haven't received any skill exchange requests yet."
                    : "You haven't sent any skill exchange requests yet."
                  }
                </p>
              </div>
            ) : (
              getFilteredRequests().map((request) => (
                <div key={request.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-slate-300" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            <span className="capitalize">{request.status}</span>
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm">
                          {formatDate(request.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Skills Exchange */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                      <h4 className="text-green-400 font-semibold mb-2">Will Teach</h4>
                      <p className="text-white">{request.skillToTeach}</p>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                      <h4 className="text-blue-400 font-semibold mb-2">Wants to Learn</h4>
                      <p className="text-white">{request.skillToLearn}</p>
                    </div>
                  </div>

                  {/* Message */}
                  {request.message && (
                    <div className="mb-4">
                      <p className="text-slate-300 text-sm italic">"{request.message}"</p>
                    </div>
                  )}

                  {/* Actions */}
                  {activeTab === 'received' && request.status === 'pending' && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'accepted')}
                        disabled={processingId === request.id}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>{processingId === request.id ? 'Accepting...' : 'Accept'}</span>
                      </button>

                      <button
                        onClick={() => handleStatusUpdate(request.id, 'declined')}
                        disabled={processingId === request.id}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                      >
                        <UserX className="w-4 h-4" />
                        <span>{processingId === request.id ? 'Declining...' : 'Decline'}</span>
                      </button>
                    </div>
                  )}

                  {activeTab === 'sent' && request.status === 'accepted' && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'completed')}
                        disabled={processingId === request.id}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{processingId === request.id ? 'Completing...' : 'Mark Complete'}</span>
                      </button>
                    </div>
                  )}

                  {request.status === 'completed' && (
                    <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <span className="text-green-300 text-sm font-medium">
                          Exchange completed successfully!
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
