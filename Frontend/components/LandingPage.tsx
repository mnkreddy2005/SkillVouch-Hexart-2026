import React from 'react';
import { View } from '../types';
import { Sparkles, Users, BookOpen, Trophy } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (view: View) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SkillVouch AI</span>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => onNavigate(View.LOGIN)}
            className="text-slate-300 hover:text-white transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => onNavigate(View.SIGNUP)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Heading */}
          <h1 className="text-6xl md:text-7xl font-bold text-white mb-6">
            SkillVouch
            <span className="text-indigo-400"> AI</span>
          </h1>

          <p className="text-xl text-slate-300 mb-8">
            Connect • Learn • Grow
          </p>

          {/* AI Badge */}
          <div className="inline-flex items-center bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 px-4 py-2 rounded-full mb-12">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Powered
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <button
              onClick={() => onNavigate(View.SIGNUP)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors shadow-lg"
            >
              Get Started Free
            </button>
            <button
              onClick={() => onNavigate(View.LOGIN)}
              className="text-slate-300 hover:text-white transition-colors text-lg underline"
            >
              Existing User?
            </button>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Connect</h3>
              <p className="text-slate-400 text-sm">
                Find peers with complementary skills for mutual learning and growth
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Learn</h3>
              <p className="text-slate-400 text-sm">
                Access AI-powered learning paths and skill development recommendations
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur-sm">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Grow</h3>
              <p className="text-slate-400 text-sm">
                Build your reputation through verified skill exchanges and feedback
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-slate-500 text-sm">
        <p>© 2024 SkillVouch AI. Connect, learn, and grow together.</p>
      </footer>
    </div>
  );
};