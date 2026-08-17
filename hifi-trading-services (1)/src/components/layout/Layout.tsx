import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  LayoutGrid, 
  Building2, 
  Contact2, 
  CalendarDays, 
  UsersRound, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  ChevronLeft, 
  ChevronRight, 
  Compass, 
  Search,
  Smartphone,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';

export default function Layout() {
  const { appUser, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const isAdminOrCeo = appUser?.role === 'SYSTEM_ADMIN' || appUser?.role === 'CEO';
  const isManager = appUser?.role === 'MARKETING_MANAGER' || isAdminOrCeo;
  const isMarketingExecutive = appUser?.role === 'MARKETING_EXECUTIVE';

  const navGroups = [
    {
      title: 'Core Platform',
      items: [
        { to: '/', icon: LayoutGrid, label: 'Dashboard' },
        { to: '/organizations', icon: Building2, label: 'Organizations' },
        { to: '/contacts', icon: Contact2, label: 'Contacts' },
      ]
    },
    {
      title: 'Field Operations',
      items: [
        ...(isMarketingExecutive ? [{ to: '/field/mode', icon: Smartphone, label: 'Field Mode (Mobile)' }] : []),
        { to: '/field/my-day', icon: Compass, label: 'My Day Planner' },
        ...(isManager ? [{ to: '/field/team-planning', icon: UsersRound, label: 'Team Planning' }] : [])
      ]
    },
    ...(isAdminOrCeo ? [{
      title: 'Administration',
      items: [
        { to: '/settings/users', icon: ShieldCheck, label: 'User & Roles' }
      ]
    }] : [])
  ];

  const mobileNavItems = [
    { to: '/', icon: LayoutGrid, label: 'Dashboard' },
    ...(isMarketingExecutive ? [{ to: '/field/mode', icon: Smartphone, label: 'Field Mode' }] : []),
    { to: '/field/my-day', icon: CalendarDays, label: 'My Day' },
    ...(isManager ? [{ to: '/field/team-planning', icon: UsersRound, label: 'Team' }] : []),
    { to: '/organizations', icon: Building2, label: 'Orgs' },
    { to: '/contacts', icon: Contact2, label: 'Contacts' },
  ];

  const allNavItems = navGroups.flatMap(g => g.items).filter(item => 
    item.label.toLowerCase().includes(sidebarSearch.toLowerCase())
  );

  return (
    <div className={cn(
      "min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-200 antialiased",
      theme === 'dark' ? "bg-[#0B0B0E] text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      {/* Mobile Header */}
      <div className={cn(
        "md:hidden sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b backdrop-blur-md transition-colors",
        theme === 'dark' ? "bg-[#15151A]/90 border-[#2A2A35] text-white" : "bg-white/90 border-slate-200 text-slate-900 shadow-xs"
      )}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="HIFI ONE Logo" className="h-8 w-auto object-contain rounded-lg border border-[#1848A0]/20" />
          <div className="leading-tight">
            <span className="font-extrabold tracking-tight text-base block">HIFI ONE</span>
            <span className="text-[9px] text-[#F88020] font-bold uppercase tracking-widest block">Trading Services</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className={cn(
              "p-2 rounded-xl border transition-all",
              theme === 'dark' 
                ? "bg-[#1F1F28] border-[#2A2A35] text-amber-400 hover:bg-[#2A2A38]" 
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            )}
            title="Toggle Light / Dark Mode"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-[#1848A0]" />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className={cn(
              "p-2 rounded-xl border transition-all",
              theme === 'dark' ? "bg-[#1F1F28] border-[#2A2A35] text-white" : "bg-slate-100 border-slate-200 text-slate-800"
            )}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside className={cn(
        "flex flex-col transition-all duration-300 z-50 border-r shrink-0",
        isMobileMenuOpen ? "fixed inset-y-0 left-0 w-72 shadow-2xl" : "hidden md:flex sticky top-0 h-screen",
        isCollapsed ? "md:w-20" : "md:w-64",
        theme === 'dark' ? "bg-[#14141B] border-[#22222E] text-gray-100" : "bg-white border-slate-200/80 text-slate-800 shadow-xs"
      )}>
        {/* Sidebar Header - Matching image.png */}
        <div className={cn(
          "p-4 px-4 flex items-center justify-between border-b shrink-0",
          theme === 'dark' ? "border-[#22222E]" : "border-slate-100"
        )}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.jpg" alt="HIFI ONE" className="h-6 w-auto object-contain rounded-md shrink-0 border border-[#1848A0]/20" />
            {!isCollapsed && (
              <span className={cn("text-base font-bold tracking-tight truncate", theme === 'dark' ? "text-white" : "text-slate-900")}>
                Admin Portal
              </span>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "hidden md:flex p-1 rounded-md border transition-colors shrink-0 opacity-70 hover:opacity-100",
              theme === 'dark'
                ? "bg-[#1C1C26] border-[#2A2A38] text-gray-400 hover:text-white"
                : "bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-900"
            )}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {isMobileMenuOpen && (
            <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Sidebar Search Bar - White rounded input pill matching image.png 100% */}
        {!isCollapsed && (
          <div className="px-3.5 pt-3.5 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search code, receipt, nan"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className={cn(
                  "w-full pl-9 pr-3.5 py-2 rounded-2xl text-xs font-normal transition-all focus:outline-none focus:ring-2 focus:ring-[#1848A0]",
                  theme === 'dark' 
                    ? "bg-[#F3F4F6] text-slate-900 placeholder-slate-400 border border-slate-200" 
                    : "bg-slate-100 text-slate-900 placeholder-slate-400 border border-slate-200"
                )}
              />
            </div>
          </div>
        )}

        {/* Navigation Section */}
        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
          {sidebarSearch ? (
            allNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group",
                    isActive 
                      ? theme === 'dark'
                        ? "bg-[#281A3C] text-[#D8B4FE] font-medium border border-[#8B5CF6]/20"
                        : "bg-[#1848A0]/10 text-[#1848A0] font-medium border border-[#1848A0]/20"
                      : theme === 'dark'
                        ? "text-slate-300 hover:bg-[#1E1E28] hover:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("w-5 h-5 shrink-0", isActive ? (theme === 'dark' ? "text-[#D8B4FE]" : "text-[#1848A0]") : "text-slate-400")} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })
          ) : (
            navGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all relative group",
                        isActive 
                          ? theme === 'dark'
                            ? "bg-[#281A3C] text-[#D8B4FE] font-medium border border-[#8B5CF6]/20 shadow-xs" 
                            : "bg-[#1848A0]/10 text-[#1848A0] font-medium border border-[#1848A0]/20 shadow-xs"
                          : theme === 'dark'
                            ? "text-slate-300 hover:bg-[#1C1C26] hover:text-white"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        isCollapsed && "justify-center px-0 py-2.5"
                      )}
                    >
                      <Icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-105", isActive ? (theme === 'dark' ? "text-[#D8B4FE]" : "text-[#1848A0]") : "text-slate-400")} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            ))
          )}
        </nav>

        {/* Footer Area - Matching image.png 100% */}
        <div className={cn("px-3 py-3 border-t shrink-0 space-y-1 mt-auto", theme === 'dark' ? "border-[#22222E]" : "border-slate-200/80")}>
          <button
            onClick={toggleTheme}
            className={cn(
              "w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left",
              theme === 'dark'
                ? "text-slate-300 hover:bg-[#1C1C26] hover:text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              isCollapsed && "justify-center px-0"
            )}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 shrink-0 text-amber-400" /> : <Moon className="w-5 h-5 shrink-0 text-[#1848A0]" />}
            {!isCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button
            onClick={signOut}
            className={cn(
              "w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left",
              theme === 'dark'
                ? "text-slate-300 hover:bg-rose-500/10 hover:text-rose-400"
                : "text-slate-600 hover:bg-rose-50 hover:text-rose-600",
              isCollapsed && "justify-center px-0"
            )}
            title="Sign Out"
          >
            <LogOut className="w-5 h-5 shrink-0 text-slate-400" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden pb-16 md:pb-0">
        <main className={cn(
          "flex-1 overflow-auto p-4 md:p-8 transition-colors duration-200",
          theme === 'dark' ? "bg-[#0B0B0E] text-slate-100" : "bg-slate-50 text-slate-900"
        )}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 border-t z-40 px-2 py-1.5 flex items-center justify-around backdrop-blur-md",
        theme === 'dark' ? "bg-[#15151A]/95 border-[#252530] text-gray-400" : "bg-white/95 border-slate-200 text-slate-600 shadow-lg"
      )}>
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all text-[10px] font-bold",
                isActive ? "text-[#1848A0] font-extrabold" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "scale-110 text-[#1848A0]")} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}


