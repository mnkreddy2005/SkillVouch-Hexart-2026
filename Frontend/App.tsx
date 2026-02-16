import React, { useState, useEffect, Suspense, lazy, ErrorInfo, ReactNode } from 'react';
import { Layout } from './components/Layout';
import { View, User } from './types';
import { INITIAL_USER } from './constants';
import { dbService } from './services/dbService';
import { Mail, Lock, User as UserIcon, AlertCircle, CheckCircle2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Logo } from './components/Logo';
import { ChatBot } from './components/ChatBot';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <div className="text-center p-8 max-w-md">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-slate-400 mb-4">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-slate-500">Error Details (Dev Only)</summary>
                <pre className="text-xs mt-2 p-2 bg-slate-800 rounded overflow-auto">
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Fallback Component
const LoadingFallback = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <p className="text-slate-400">Loading SkillVouch...</p>
    </div>
  </div>
);

// Network Status Component
const NetworkStatus = ({ isOnline }: { isOnline: boolean }) => (
  !isOnline && (
    <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-200 px-4 py-2 rounded-lg flex items-center gap-2">
      <WifiOff className="w-4 h-4" />
      <span className="text-sm">You're offline. Some features may not work.</span>
    </div>
  )
);

const Dashboard = lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const SkillList = lazy(() => import('./components/SkillList').then(module => ({ default: module.SkillList })));
const MatchFinder = lazy(() => import('./components/MatchFinder').then(module => ({ default: module.MatchFinder })));
const RoadmapView = lazy(() => import('./components/RoadmapView').then(module => ({ default: module.RoadmapView })));
const ChatView = lazy(() => import('./components/ChatView').then(module => ({ default: module.ChatView })));
const LandingPage = lazy(() => import('./components/LandingPage').then(module => ({ default: module.LandingPage })));
const ProfileView = lazy(() => import('./components/ProfileView').then(module => ({ default: module.ProfileView })));
export function generateUUID(): string {
  // Use native if available
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }

  // Use getRandomValues (RFC4122 v4) if available
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(16);
    (crypto as any).getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10,16).join('')}`;
  }

  // Fallback (not cryptographically secure)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function App() {
  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <div className="min-h-screen bg-slate-950">
          {/* Network Status Indicator */}
          <div className="fixed top-4 right-4 z-50">
            <NetworkStatus isOnline={isOnline} />
          </div>

          {/* Main App Content */}
          <AppContent
            isOnline={isOnline}
            currentView={View.LANDING}
            setCurrentView={(view) => console.log(view)}
            user={INITIAL_USER}
            setUser={(user) => console.log(user)}
            unreadCount={0}
            setUnreadCount={(count) => console.log(count)}
            loadingSession={true}
            setLoadingSession={(loading) => console.log(loading)}
            isChatBotOpen={false}
            setIsChatBotOpen={(open) => console.log(open)}
            notification={null}
            setNotification={(notification) => console.log(notification)}
            selectedChatUserId={undefined}
            setSelectedChatUserId={(userId) => console.log(userId)}
            email={''}
            setEmail={(email) => console.log(email)}
            password={''}
            setPassword={(password) => console.log(password)}
            confirmPassword={''}
            setConfirmPassword={(confirmPassword) => console.log(confirmPassword)}
            fullName={''}
            setFullName={(fullName) => console.log(fullName)}
            authError={''}
            setAuthError={(error) => console.log(error)}
            isSubmitting={false}
            setIsSubmitting={(submitting) => console.log(submitting)}
            handleUpdateUser={(user) => console.log(user)}
            handleLogout={() => console.log('Logout')}
            handleLogin={(e) => console.log(e)}
            handleSignup={(e) => console.log(e)}
            navigateToView={(view) => console.log(view)}
            renderView={() => console.log('Render View')}
          />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}

// Separate component for main app logic to avoid re-rendering issues
function AppContent({
  isOnline,
  currentView,
  setCurrentView,
  user,
  setUser,
  unreadCount,
  setUnreadCount,
  loadingSession,
  setLoadingSession,
  isChatBotOpen,
  setIsChatBotOpen,
  notification,
  setNotification,
  selectedChatUserId,
  setSelectedChatUserId,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  fullName,
  setFullName,
  authError,
  setAuthError,
  isSubmitting,
  setIsSubmitting,
  handleUpdateUser,
  handleLogout,
  handleLogin,
  handleSignup,
  navigateToView,
  renderView
}) {
  // Default to LANDING view unless session exists
  const [initialView] = useState(View.LANDING);
  const [userState, setUserState] = useState<User>(INITIAL_USER);
  const [unreadCountState, setUnreadCountState] = useState(0);
  const [loadingSessionState, setLoadingSessionState] = useState(true);
  const [isChatBotOpenState, setIsChatBotOpenState] = useState(false);

  // Notification State
  const [notificationState, setNotificationState] = useState<{message: string, type: 'success'} | null>(null);

  // Navigation State params
  const [selectedChatUserIdState, setSelectedChatUserIdState] = useState<string | undefined>(undefined);

  // Auth Form State
  const [emailState, setEmailState] = useState('');
  const [passwordState, setPasswordState] = useState('');
  const [confirmPasswordState, setConfirmPasswordState] = useState('');
  const [fullNameState, setFullNameState] = useState('');

  const [authErrorState, setAuthErrorState] = useState('');
  const [isSubmittingState, setIsSubmittingState] = useState(false);

  // Session Check Logic
  useEffect(() => {
    const checkSession = async () => {
        const sessionUser = dbService.getCurrentSession();
        if (sessionUser) {
            // Validate against DB to get fresh data
            const freshUser = await dbService.getUserById(sessionUser.id);
            if (freshUser) {
                setUserState(freshUser);
                if (initialView === View.LANDING || initialView === View.LOGIN || initialView === View.SIGNUP) {
                    setCurrentView(View.DASHBOARD);
                }
            } else {
                // Session invalid (user deleted?)
                dbService.logout();
                setUserState(INITIAL_USER);
            }
        }
        setLoadingSessionState(false);
    };
    checkSession();
  }, [initialView]);

  // Poll for unread messages count
  useEffect(() => {
    let interval: any;
    if (userState.id !== 'temp') {
        const fetchUnread = async () => {
             try {
                 const count = await dbService.getUnreadCount(userState.id);
                 setUnreadCountState(count);
             } catch (error) {
                 console.error('Failed to fetch unread count:', error);
             }
        };
        fetchUnread();

        interval = setInterval(fetchUnread, 5000); // Reduced frequency from 3s to 5s
    }
    return () => clearInterval(interval);
  }, [userState.id]);

  // Auto-dismiss notification
  useEffect(() => {
    if (notificationState) {
      const timer = setTimeout(() => {
        setNotificationState(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notificationState]);

  const handleUpdateUserLocal = (updatedUser: User) => {
    setUserState(updatedUser);
  };

  const handleLogoutLocal = async () => {
    await dbService.logout();
    setUserState(INITIAL_USER);
    setEmailState('');
    setPasswordState('');
    setCurrentView(View.LANDING);
  };

  const handleLoginLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorState('');
    setIsSubmittingState(true);
    try {
        const loggedInUser = await dbService.login(emailState, passwordState);
        setUserState(loggedInUser);
        setCurrentView(View.DASHBOARD);
        setNotificationState({ message: `Welcome back, ${loggedInUser.name.split(' ')[0]}!`, type: 'success' });
    } catch (err: any) {
        setAuthErrorState(err.message || 'Invalid email or password.');
        console.error(err);
    } finally {
        setIsSubmittingState(false);
    }
  };

  const handleSignupLocal = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorState('');
    if (!fullNameState || !emailState || !passwordState || !confirmPasswordState) {
      setAuthErrorState('Please fill in all required fields.');
      return;
    }

    if (passwordState !== confirmPasswordState) {
        setAuthErrorState('Passwords do not match.');
        return;
    }

    setIsSubmittingState(true);
    try {
      // Create account but do NOT auto-login
      // Removed location from signup
      await dbService.signup(fullNameState, emailState, passwordState);

      // Redirect to Login view
      setCurrentView(View.LOGIN);
      setNotificationState({ message: 'Account created successfully! Please log in.', type: 'success' });

      // Clear passwords
      setPasswordState('');
      setConfirmPasswordState('');

    } catch (err: any) {
      setAuthErrorState(err.message || 'Signup failed.');
    } finally {
        setIsSubmittingState(false);
    }
  };

  // Custom navigation handler to support passing params (like chat user id)
  const navigateToViewLocal = (view: View, params?: any) => {
      if (view !== View.MESSAGES) {
          setSelectedChatUserIdState(undefined);
      }
      setCurrentView(view);
  };

  const renderViewLocal = () => {
    if (loadingSessionState) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                 <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    switch (currentView) {
      case View.DASHBOARD:
        return (
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>}>
                <Dashboard
                    user={userState}
                    onNavigateToProfile={(userId) => {
                        setSelectedChatUserIdState(userId);
                        setCurrentView(View.MESSAGES);
                    }}
                    onNavigate={navigateToViewLocal}
                />
            </Suspense>
        );
      case View.MY_SKILLS:
        return (
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>}>
                <SkillList user={userState} onUpdateUser={handleUpdateUserLocal} />
            </Suspense>
        );
      case View.FIND_PEERS:
        return (
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>}>
                <MatchFinder
                    currentUser={userState}
                    onMessageUser={(userId) => {
                        setSelectedChatUserIdState(userId);
                        setCurrentView(View.MESSAGES);
                    }}
                />
            </Suspense>
        );
      case View.LEARN_ROADMAP:
        return (
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>}>
                <RoadmapView user={userState} onNavigate={navigateToViewLocal} />
            </Suspense>
        );
      case View.MESSAGES:
        return (
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>}>
                <ChatView
                    currentUser={userState}
                    selectedUserId={selectedChatUserIdState}
                    onNavigate={navigateToViewLocal}
                />
            </Suspense>
        );
      case View.PROFILE:
        return (
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>}>
                <ProfileView
                    user={userState}
                    onUpdateUser={handleUpdateUserLocal}
                    onNavigate={navigateToViewLocal}
                />
            </Suspense>
        );
      case View.LANDING:
        return (
            <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-950"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div></div>}>
                <LandingPage onNavigate={setCurrentView} />
            </Suspense>
        );
      case View.LOGIN:
        if (loadingSessionState) {
            return (
                <div className="flex h-screen items-center justify-center bg-slate-950">
                     <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
            );
        }
        return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <NotificationToast />
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10 animate-fade-in">
              {/* Back Button for Login */}
              <button onClick={() => setCurrentView(View.LANDING)} className="text-slate-500 hover:text-white mb-4 text-sm flex items-center">
                ← Back to Home
              </button>

              <div className="flex flex-col items-center justify-center mb-6 text-indigo-500">
                 <Logo className="w-20 h-20 mb-2 shadow-2xl" />
              </div>
              <h1 className="text-3xl font-bold text-center text-white mb-2">Welcome Back</h1>
              <p className="text-center text-slate-400 mb-8">Sign in to your account.</p>

              {authErrorState && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{authErrorState}</span>
                </div>
              )}

              <form onSubmit={handleLoginLocal} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={emailState}
                    onChange={(e) => setEmailState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={passwordState}
                    onChange={(e) => setPasswordState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <button disabled={isSubmittingState} type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                  {isSubmittingState ? 'Logging in...' : 'Login'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-slate-500">
                  Don't have an account?{' '}
                  <button onClick={() => { setAuthErrorState(''); setCurrentView(View.SIGNUP); }} className="text-indigo-400 hover:text-indigo-300 font-medium">
                    Sign up
                  </button>
                </p>
              </div>
            </div>
          </div>
        );
      case View.SIGNUP:
        if (loadingSessionState) {
            return (
                <div className="flex h-screen items-center justify-center bg-slate-950">
                     <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
            );
        }
        return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <NotificationToast />
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10 animate-fade-in">
              {/* Back Button for Signup */}
              <button onClick={() => setCurrentView(View.LANDING)} className="text-slate-500 hover:text-white mb-4 text-sm flex items-center">
                ← Back to Home
              </button>

              <div className="flex flex-col items-center justify-center mb-6 text-indigo-500">
                 <Logo className="w-20 h-20 mb-2 shadow-2xl" />
              </div>
              <h1 className="text-3xl font-bold text-center text-white mb-2">Create Account</h1>
              <p className="text-center text-slate-400 mb-8">Join the community of learners.</p>

              {authErrorState && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{authErrorState}</span>
                </div>
              )}

              <form onSubmit={handleSignupLocal} className="space-y-4">
                 <div className="relative">
                  <UserIcon className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={fullNameState}
                    onChange={(e) => setFullNameState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    placeholder="Email"
                    value={emailState}
                    onChange={(e) => setEmailState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={passwordState}
                    onChange={(e) => setPasswordState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPasswordState}
                    onChange={(e) => setConfirmPasswordState(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <button disabled={isSubmittingState} type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50">
                  {isSubmittingState ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-slate-500">
                  Already have an account?{' '}
                  <button onClick={() => { setAuthErrorState(''); setCurrentView(View.LOGIN); }} className="text-indigo-400 hover:text-indigo-300 font-medium">
                    Log in
                  </button>
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
                    <button onClick={() => setCurrentView(View.LANDING)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg">
                        Go Home
                    </button>
                </div>
            </div>
        );
    }
  };

  // Notification Toast Component
  const NotificationToast = () => {
    if (!notificationState) return null;

    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
        <div className="bg-green-900/90 border border-green-700 text-green-200 px-6 py-3 rounded-lg flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{notificationState.message}</span>
        </div>
      </div>
    );
  };

  return (
    <>
    <NotificationToast />
    <Layout
      currentView={currentView}
      onNavigate={navigateToViewLocal}
      user={userState}
      onLogout={handleLogoutLocal}
      unreadCount={unreadCountState}
    >
      {renderViewLocal()}
    </Layout>
    <ChatBot isOpen={isChatBotOpenState} onToggle={() => setIsChatBotOpenState(!isChatBotOpenState)} />
    </>
  );
}