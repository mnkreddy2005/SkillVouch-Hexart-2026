import React, { useState, useEffect } from 'react';
import { View, User } from '../types';
import {
  Plus,
  CheckCircle2,
  Circle,
  Edit3,
  Save,
  X,
  Clock,
  BookOpen,
  Users,
  Map,
  MessageSquare,
  User as UserIcon,
  LogOut,
  Sparkles,
  Trash2
} from 'lucide-react';

interface Skill {
  name: string;
  verified: boolean;
  level: string;
  experienceYears: number;
  availability: string[];
}

interface SkillsPageProps {
  user: User;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
  unreadCount: number;
}

export const SkillsPage: React.FC<SkillsPageProps> = ({
  user,
  onNavigate,
  onLogout,
  onUpdateUser,
  unreadCount
}) => {
  const [skills, setSkills] = useState<Skill[]>(user.skillsKnown || []);
  const [newSkill, setNewSkill] = useState<Partial<Skill>>({
    name: '',
    verified: false,
    level: 'beginner',
    experienceYears: 0,
    availability: []
  });
  const [editingSkill, setEditingSkill] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const sidebarItems = [
    { view: View.DASHBOARD, icon: Users, label: "Dashboard" },
    { view: View.MY_SKILLS, icon: BookOpen, label: "My Skills", active: true },
    { view: View.FIND_PEERS, icon: Users, label: "Find Peers" },
    { view: View.ROADMAP, icon: Map, label: "Learning Path" },
    { view: View.MESSAGES, icon: MessageSquare, label: "Messages", badge: unreadCount },
    { view: View.PROFILE, icon: UserIcon, label: "Profile" }
  ];

  const skillLevels = ['beginner', 'intermediate', 'advanced', 'expert'];
  const availabilityOptions = ['weekdays', 'weekends', 'evenings', 'mornings'];

  const handleAddSkill = async () => {
    if (!newSkill.name?.trim()) return;

    const skillToAdd: Skill = {
      name: newSkill.name.trim(),
      verified: newSkill.verified || false,
      level: newSkill.level || 'beginner',
      experienceYears: newSkill.experienceYears || 0,
      availability: newSkill.availability || []
    };

    setSaving(true);
    try {
      const updatedSkills = [...skills, skillToAdd];
      const updatedUser = { ...user, skillsKnown: updatedSkills };
      await onUpdateUser(updatedUser);
      setSkills(updatedSkills);
      setNewSkill({
        name: '',
        verified: false,
        level: 'beginner',
        experienceYears: 0,
        availability: []
      });
      setIsAdding(false);
    } catch (error) {
      console.error('Failed to add skill:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSkill = async (index: number, updatedSkill: Skill) => {
    setSaving(true);
    try {
      const updatedSkills = [...skills];
      updatedSkills[index] = updatedSkill;
      const updatedUser = { ...user, skillsKnown: updatedSkills };
      await onUpdateUser(updatedUser);
      setSkills(updatedSkills);
      setEditingSkill(null);
    } catch (error) {
      console.error('Failed to update skill:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async (index: number) => {
    if (!confirm('Are you sure you want to delete this skill?')) return;

    setSaving(true);
    try {
      const updatedSkills = skills.filter((_, i) => i !== index);
      const updatedUser = { ...user, skillsKnown: updatedSkills };
      await onUpdateUser(updatedUser);
      setSkills(updatedSkills);
    } catch (error) {
      console.error('Failed to delete skill:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = (skill: Partial<Skill>, option: string) => {
    const currentAvailability = skill.availability || [];
    const updatedAvailability = currentAvailability.includes(option)
      ? currentAvailability.filter(a => a !== option)
      : [...currentAvailability, option];

    return { ...skill, availability: updatedAvailability };
  };

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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">My Skills</h1>
            <p className="text-slate-400">Manage your skills, get verified, and showcase your expertise.</p>
          </div>

          {/* Add Skill Button */}
          {!isAdding && (
            <button
              onClick={() => setIsAdding(true)}
              className="mb-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Skill</span>
            </button>
          )}

          {/* Add Skill Form */}
          {isAdding && (
            <div className="mb-8 bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">Add New Skill</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Skill Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Skill Name</label>
                  <input
                    type="text"
                    value={newSkill.name || ''}
                    onChange={(e) => setNewSkill(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., React, Python, UI/UX Design"
                  />
                </div>

                {/* Experience Years */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    value={newSkill.experienceYears || 0}
                    onChange={(e) => setNewSkill(prev => ({ ...prev, experienceYears: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Skill Level */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Skill Level</label>
                <div className="flex space-x-4">
                  {skillLevels.map((level) => (
                    <label key={level} className="flex items-center">
                      <input
                        type="radio"
                        name="level"
                        value={level}
                        checked={newSkill.level === level}
                        onChange={(e) => setNewSkill(prev => ({ ...prev, level: e.target.value }))}
                        className="mr-2"
                      />
                      <span className="text-slate-300 capitalize">{level}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">Availability</label>
                <div className="flex flex-wrap gap-2">
                  {availabilityOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => setNewSkill(prev => toggleAvailability(prev, option))}
                      className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
                        newSkill.availability?.includes(option)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-4">
                <button
                  onClick={handleAddSkill}
                  disabled={!newSkill.name?.trim() || saving}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Skill'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewSkill({
                      name: '',
                      verified: false,
                      level: 'beginner',
                      experienceYears: 0,
                      availability: []
                    });
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {/* Skills List */}
          <div className="space-y-4">
            {skills.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-400 mb-2">No skills added yet</h3>
                <p className="text-slate-500">Start building your skill profile by adding your first skill.</p>
              </div>
            ) : (
              skills.map((skill, index) => (
                <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
                  {editingSkill === index ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Skill Name</label>
                          <input
                            type="text"
                            value={skill.name}
                            onChange={(e) => {
                              const updatedSkill = { ...skill, name: e.target.value };
                              setSkills(prev => prev.map((s, i) => i === index ? updatedSkill : s));
                            }}
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">Years of Experience</label>
                          <input
                            type="number"
                            min="0"
                            value={skill.experienceYears}
                            onChange={(e) => {
                              const updatedSkill = { ...skill, experienceYears: parseInt(e.target.value) || 0 };
                              setSkills(prev => prev.map((s, i) => i === index ? updatedSkill : s));
                            }}
                            className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Skill Level</label>
                        <div className="flex space-x-4">
                          {skillLevels.map((level) => (
                            <label key={level} className="flex items-center">
                              <input
                                type="radio"
                                name={`level-${index}`}
                                value={level}
                                checked={skill.level === level}
                                onChange={(e) => {
                                  const updatedSkill = { ...skill, level: e.target.value };
                                  setSkills(prev => prev.map((s, i) => i === index ? updatedSkill : s));
                                }}
                                className="mr-2"
                              />
                              <span className="text-slate-300 capitalize">{level}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Availability</label>
                        <div className="flex flex-wrap gap-2">
                          {availabilityOptions.map((option) => (
                            <button
                              key={option}
                              onClick={() => {
                                const updatedSkill = toggleAvailability(skill, option);
                                setSkills(prev => prev.map((s, i) => i === index ? updatedSkill : s));
                              }}
                              className={`px-3 py-1 rounded-full text-sm capitalize transition-colors ${
                                skill.availability.includes(option)
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex space-x-4">
                        <button
                          onClick={() => handleUpdateSkill(index, skill)}
                          disabled={saving}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                        >
                          <Save className="w-4 h-4" />
                          <span>{saving ? 'Saving...' : 'Save'}</span>
                        </button>

                        <button
                          onClick={() => setEditingSkill(null)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-xl font-bold text-white">{skill.name}</h3>
                          {skill.verified ? (
                            <CheckCircle2 className="w-6 h-6 text-green-400" />
                          ) : (
                            <Circle className="w-6 h-6 text-slate-500" />
                          )}
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingSkill(index)}
                            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteSkill(index)}
                            className="text-slate-400 hover:text-red-400 p-2 rounded-lg hover:bg-slate-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-slate-400 text-sm mb-1">Level</p>
                          <p className="text-white font-semibold capitalize">{skill.level}</p>
                        </div>

                        <div>
                          <p className="text-slate-400 text-sm mb-1">Experience</p>
                          <p className="text-white font-semibold">{skill.experienceYears} years</p>
                        </div>

                        <div>
                          <p className="text-slate-400 text-sm mb-1">Status</p>
                          <p className={`font-semibold ${skill.verified ? 'text-green-400' : 'text-yellow-400'}`}>
                            {skill.verified ? 'Verified' : 'Unverified'}
                          </p>
                        </div>
                      </div>

                      {skill.availability.length > 0 && (
                        <div>
                          <p className="text-slate-400 text-sm mb-2">Available:</p>
                          <div className="flex flex-wrap gap-2">
                            {skill.availability.map((time) => (
                              <span key={time} className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded capitalize">
                                {time}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
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
