import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Plane, LayoutDashboard, Calendar, Clock, BedDouble, Shield, Settings,
  LogOut, Bell, Menu, ChevronLeft, Home, HelpCircle
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FeedbackFAB } from '@/components/FeedbackFAB';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/schedule', label: 'Escala', icon: Calendar },
  { path: '/duty-calc', label: 'Jornada', icon: Clock },
  { path: '/rest-calc', label: 'Descanso', icon: BedDouble },
  { path: '/regulation', label: 'Regulamentação', icon: Shield },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { signOut, profile, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    };
    load();
    const channel = supabase
      .channel('notif-badge')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleLogout = async () => { await signOut(); window.location.href = '/'; };
  const initials = profile?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const pageTitle = navItems.find(n => location.pathname === n.path)?.label || '';

  return (
    <div className="min-h-screen flex bg-background">

      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:flex flex-col w-[240px] shrink-0 sticky top-0 h-screen border-r border-border bg-card">
        {/* Brand */}
        <div className="px-5 h-16 flex items-center gap-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-base font-bold text-foreground tracking-tight">EscalaX</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}>
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile + Logout */}
        <div className="p-3 border-t border-border space-y-2">
          {profile && (
            <Link to="/profile" className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-secondary transition-colors">
              <Avatar className="w-7 h-7">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{profile.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{profile.airline || profile.email}</p>
              </div>
            </Link>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* ═══ Main Column ═══ */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile Header */}
        <header className="sticky top-0 z-40 h-14 px-4 flex items-center justify-between bg-card/90 backdrop-blur-xl border-b border-border lg:hidden">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => navigate('/dashboard')} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
              <Home className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 ml-1">
              <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center">
                <Plane className="w-3 h-3 text-primary-foreground" />
              </div>
              {pageTitle && <span className="text-sm font-semibold text-foreground">{pageTitle}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
              )}
            </Link>
            <button onClick={() => setDrawerOpen(true)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden lg:flex h-14 px-6 items-center justify-between border-b border-border bg-card/50 backdrop-blur-xl">
          <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
          <div className="flex items-center gap-3">
            <Link to="/support" className="text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="w-4 h-4" />
            </Link>
            <Link to="/notifications" className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">{unreadCount}</span>
              )}
            </Link>
          </div>
        </header>

        {/* Mobile Drawer */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-72 bg-card border-border p-0">
            <SheetHeader className="p-4 border-b border-border">
              <SheetTitle className="text-foreground text-left text-sm">Menu</SheetTitle>
            </SheetHeader>
            {profile && (
              <Link to="/profile" onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 mx-3 mt-3 mb-2 p-3 rounded-xl bg-secondary">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile.airline || profile.email}</p>
                </div>
              </Link>
            )}
            <nav className="p-3 space-y-0.5">
              {navItems.map(item => {
                const active = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}>
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              <Link to="/support" onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
                <HelpCircle className="w-4 h-4" /> Suporte
              </Link>
            </nav>
            <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border">
              <button onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-secondary w-full">
                <LogOut className="w-4 h-4" /> Sair
              </button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Content */}
        <main className="flex-1">
          <div className="px-4 py-5 md:px-6 md:py-6 lg:px-8 lg:py-8 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>

        <FeedbackFAB />
        <PWAInstallPrompt />
      </div>
    </div>
  );
}
