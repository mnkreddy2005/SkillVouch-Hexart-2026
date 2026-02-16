import React, { useEffect, useState } from 'react';
import { View, User } from '../types';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Map,
  MessageSquare,
  User as UserIcon,
  LogOut,
  CheckCircle2,
  UserCheck,
  Trophy,
  Star,
  Sparkles,
  UserPlus
} from 'lucide-react';

interface DashboardProps {
  user: User;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  unreadCount: number;
}

interface DashboardStats {
  verifiedSkills: number;
  activeConnections: number;
  successfulExchanges: number;
  profileRating: number;
}

interface SkillRecommendation {
  name: string;
  reason: string;
  confidence: number;
}

interface PeerSuggestion {
  id: string;
  name: string;
  avatar?: string;
  skillsOffered: string[];
  skillsNeeded: string[];
  matchScore: number;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  onNavigate,
  onLogout,
  unreadCount
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    verifiedSkills: 0,
    activeConnections: 0,
    successfulExchanges: 0,
    profileRating: 5.0
  });

  const [skillRecommendations, setSkillRecommendations] = useState<SkillRecommendation[]>([]);
  const [peerSuggestions, setPeerSuggestions] = useState<PeerSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Calculate stats from user data
        const verifiedSkillsCount = user.skillsKnown?.filter(skill => skill.verified).length || 0;
        const activeConnections = 0; // Would come from requests API
        const successfulExchanges = 0; // Would come from completed requests

        setStats({
          verifiedSkills: verifiedSkillsCount,
          activeConnections,
          successfulExchanges,
          profileRating: 5.0
        });

        // Mock AI recommendations (would come from API)
        setSkillRecommendations([
          { name: "React Advanced Patterns", reason: "Complements your React skills", confidence: 0.85 },
          { name: "TypeScript", reason: "Enhances your JavaScript development", confidence: 0.78 },
          { name: "Node.js", reason: "Enables full-stack development", confidence: 0.72 }
        ]);

        // Mock peer suggestions (would come from API)
        setPeerSuggestions([
          {
            id: "1",
            name: "Alex Chen",
            skillsOffered: ["Python", "Data Science"],
            skillsNeeded: ["React", "JavaScript"],
            matchScore: 92
          },
          {
            id: "2",
            name: "Maria Garcia",
            skillsOffered: ["UI/UX Design", "Figma"],
            skillsNeeded: ["HTML", "CSS"],
            matchScore: 88
          }
        ]);

      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id && user.id !== "temp") {
      fetchDashboardData();
    }
  }, [user]);

  const sidebarItems = [
    { view: View.DASHBOARD, icon: LayoutDashboard, label: "Dashboard", active: true },
    { view: View.MY_SKILLS, icon: BookOpen, label: "My Skills" },
    { view: View.FIND_PEERS, icon: Users, label: "Find Peers" },
    { view: View.ROADMAP, icon: Map, label: "Learning Path" },
    { view: View.MESSAGES, icon: MessageSquare, label: "Messages", badge: unreadCount },
    { view: View.PROFILE, icon: UserIcon, label: "Profile" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading dashboard...</div>
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

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
            <p className="text-slate-400">Welcome back, {user.name}! Here's your learning overview.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Verified Skills</p>
                  <p className="text-2xl font-bold text-white">{stats.verifiedSkills}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Active Connections</p>
                  <p className="text-2xl font-bold text-white">{stats.activeConnections}</p>
                </div>
                <UserCheck className="w-8 h-8 text-blue-400" />
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Successful Exchanges</p>
                  <p className="text-2xl font-bold text-white">{stats.successfulExchanges}</p>
                </div>
                <Trophy className="w-8 h-8 text-yellow-400" />
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Profile Rating</p>
                  <p className="text-2xl font-bold text-white">{stats.profileRating.toFixed(1)}</p>
                </div>
                <Star className="w-8 h-8 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Skill Recommendations */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Personalized Skill Recommendations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {skillRecommendations.map((rec, index) => (
                <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold">{rec.name}</h3>
                    <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">
                      {Math.round(rec.confidence * 100)}% match
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{rec.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Peer Suggestions */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Recommended For You</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {peerSuggestions.map((peer) => (
                <div key={peer.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                        <UserPlus className="w-5 h-5 text-slate-300" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{peer.name}</h3>
                        <p className="text-slate-400 text-sm">{peer.matchScore}% match</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Can teach you:</p>
                      <div className="flex flex-wrap gap-1">
                        {peer.skillsOffered.map((skill, idx) => (
                          <span key={idx} className="bg-green-600/20 text-green-300 text-xs px-2 py-1 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-400 text-xs mb-1">Wants to learn:</p>
                      <div className="flex flex-wrap gap-1">
                        {peer.skillsNeeded.map((skill, idx) => (
                          <span key={idx} className="bg-blue-600/20 text-blue-300 text-xs px-2 py-1 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                    Send Request
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
