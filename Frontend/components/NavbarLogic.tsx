// Navbar shows Login only if user is null
// Updated Layout.tsx navbar logic:

{user && user.id !== 'temp' ? (
  // Authenticated user - show profile and logout
  <>
    <NavItem view={View.PROFILE} icon={UserCircle} label="Profile" />
    <button onClick={onLogout} className="...">
      <LogOut className="w-5 h-5" />
      <span className="font-medium">Sign Out</span>
    </button>
    <div className="mt-4 px-4 flex items-center space-x-3">
      <img src={user.avatar} alt="User" className="w-8 h-8 rounded-full border border-slate-700" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{user.name}</p>
        <p className="text-xs text-slate-500 truncate">{user.email}</p>
      </div>
    </div>
  </>
) : (
  // Not authenticated - show login button
  <button onClick={() => onNavigate(View.LOGIN)} className="...">
    <UserCircle className="w-5 h-5" />
    <span className="font-medium">Login</span>
  </button>
)}
