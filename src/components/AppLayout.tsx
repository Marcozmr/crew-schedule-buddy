import { ReactNode, useState, useEffect } from 'react';
import { Link as RouterLink, useInRouterContext, useLocation, useNavigate } from 'react-router-dom';
import { Plane, LayoutDashboard, Calendar, Clock, BedDouble, Shield, Settings, LogOut, Bell, ChevronLeft, HelpCircle, Cloud, CalendarClock, Users, Home, Map, BarChart2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { FeedbackFAB } from '@/components/FeedbackFAB';
import { ConnectedRosterLifecycle } from '@/components/roster/ConnectedRosterLifecycle';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { AppShell } from '@/components/layout/AppShell';
import { useFlightNotifications } from '@/hooks/useFlightNotifications';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/minha-escala', label: 'Minha escala', icon: CalendarClock },
  { path: '/schedule', label: 'Calendário da escala', icon: Calendar },
  { path: '/connections', label: 'Conexões', icon: Users },
  { path: '/duty-calc', label: 'Calcular jornada', icon: Clock },
  { path: '/rest-calc', label: 'Calcular descanso', icon: BedDouble },
  { path: '/regulation', label: 'Calculadora operacional', icon: Shield },
  { path: '/weather', label: 'MetCenter', icon: Cloud },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

const bottomNavItems = [
  { path: '/dashboard', label: 'Início', icon: Home },
  { path: '/schedule', label: 'Escala', icon: Calendar },
  { path: '/weather', label: 'MetCenter', icon: Map },
  { path: '/salary', label: 'Stats', icon: BarChart2 },
  { path: '/settings', label: 'Ajustes', icon: Settings },
];

const mainTabPaths = new Set(['/dashboard', '/schedule', '/weather', '/salary', '/settings']);

function desktopNavLinkClass(active: boolean) {
  return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
    active
      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground'
  }`;
}

interface AppNavLinkProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  to: string;
}

function AppNavLink({ children, className, onClick, to }: AppNavLinkProps) {
  const hasRouter = useInRouterContext();
  if (!hasRouter) {
    return <a href={to} className={className} onClick={onClick}>{children}</a>;
  }
  return <RouterLink to={to} className={className} onClick={onClick}>{children}</RouterLink>;
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch h-[54px]">
        {bottomNavItems.map((item) => {
          const active = pathname === item.path;
          return (
            <AppNavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-[3px] flex-1 transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground/60'
              }`}
            >
              <item.icon className={`w-[22px] h-[22px] ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className={`text-[10px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </AppNavLink>
          );
        })}
      </div>
    </nav>
  );
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { signOut, profile, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  useFlightNotifications();

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
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleLogout = async () => { await signOut(); window.location.href = '/'; };
  const initials = profile?.name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const pageTitle = navItems.find((item) => location.pathname === item.path)?.label || '';
  const pathname = location.pathname;

  return (
    <AppShell>
      <div className="flex min-h-dvh w-full min-w-0 flex-1 flex-col overflow-x-clip bg-background lg:flex-row">
        <ConnectedRosterLifecycle />

        {/* Desktop sidebar */}
        <aside className="hidden w-[248px] shrink-0 flex-col border-b border-border bg-card safe-area-top safe-area-bottom dark:border-border dark:bg-card/50 lg:sticky lg:top-0 lg:flex lg:h-screen lg:min-h-dvh lg:border-b-0 lg:border-r lg:border-border lg:shadow-sm">
          <div className="flex h-16 items-center gap-3 border-b border-border px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-sm">
              <Plane className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-foreground">EscalaX</span>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const active = pathname === item.path;
              return (
                <AppNavLink key={item.path} to={item.path} className={desktopNavLinkClass(active)}>
                  <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-sidebar-primary-foreground' : ''}`} />
                  <span>{item.label}</span>
                </AppNavLink>
              );
            })}
          </nav>
          <div className="space-y-2 border-t border-border p-3">
            {profile && (
              <AppNavLink to="/profile" className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-secondary transition-colors">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{profile.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{profile.airline || profile.email}</p>
                </div>
              </AppNavLink>
            )}
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip bg-background">
          {/* Mobile top header */}
          {mainTabPaths.has(pathname) ? (
            <header className="sticky top-0 z-40 h-11 px-4 flex items-center justify-between bg-card/95 backdrop-blur-xl border-b border-border lg:hidden safe-area-top">
              <div className="w-8" />
              <span className="text-[15px] font-semibold text-foreground">EscalaX</span>
              <AppNavLink
                to="/notifications"
                className="relative p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </AppNavLink>
            </header>
          ) : (
            <header className="sticky top-0 z-40 h-11 px-1 flex items-center bg-card/95 backdrop-blur-xl border-b border-border lg:hidden safe-area-top">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-primary hover:text-foreground rounded-lg transition-colors shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="flex-1 text-center text-[15px] font-semibold text-foreground pr-9 truncate">
                {pageTitle || 'EscalaX'}
              </span>
            </header>
          )}

          {/* Desktop top header */}
          <header className="hidden h-[4.25rem] items-center justify-between border-b border-border/80 bg-card/90 px-4 backdrop-blur-xl dark:border-border dark:bg-card/30 sm:px-5 lg:flex lg:px-6 xl:px-8 2xl:px-12">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-foreground lg:text-3xl">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <AppNavLink
                to="/support"
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </AppNavLink>
              <AppNavLink
                to="/notifications"
                className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </AppNavLink>
              {profile && (
                <AppNavLink
                  to="/profile"
                  className="ml-1 flex items-center gap-2 rounded-xl border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-border dark:hover:bg-secondary"
                >
                  <Avatar className="h-9 w-9 border border-slate-200/80 shadow-sm dark:border-border">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-800 xl:inline dark:text-foreground">
                    {profile.name}
                  </span>
                </AppNavLink>
              )}
            </div>
          </header>

          {/* Mobile drawer */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetContent side="right" className="w-[85vw] max-w-[320px] bg-background border-border p-0 flex flex-col max-h-dvh">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              {profile && (
                <AppNavLink
                  to="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-4 px-5 py-5 border-b border-border bg-card safe-area-top shrink-0"
                >
                  <Avatar className="w-14 h-14 shrink-0">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground truncate">{profile.name?.toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground truncate">{profile.airline || ''}</p>
                  </div>
                </AppNavLink>
              )}
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map((item) => {
                  const active = pathname === item.path;
                  return (
                    <AppNavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      {item.label}
                    </AppNavLink>
                  );
                })}
                <AppNavLink
                  to="/support"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:bg-secondary hover:text-foreground"
                >
                  <HelpCircle className="w-[18px] h-[18px] shrink-0 text-muted-foreground" /> Suporte
                </AppNavLink>
              </nav>
              <div className="px-3 py-3 border-t border-border safe-area-bottom">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive/80 hover:bg-destructive/8 hover:text-destructive transition-colors w-full"
                >
                  <LogOut className="w-[18px] h-[18px] shrink-0" /> Sair da conta
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <main className="flex min-h-0 flex-1 overflow-x-hidden overflow-y-visible bg-background">
            <div className="w-full max-w-none px-3 py-5 pb-safe-content sm:px-4 sm:py-6 md:px-5 md:py-7 lg:px-6 lg:py-8 xl:px-8 2xl:px-12 safe-area-bottom">
              {children}
            </div>
          </main>

          <FeedbackFAB open={feedbackOpen} onOpenChange={setFeedbackOpen} hideTrigger />
          <PWAInstallPrompt />
        </div>

        <MobileBottomNav pathname={pathname} />
      </div>
    </AppShell>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const hasRouter = useInRouterContext();

  if (!hasRouter) {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const navigate = (to: string | number) => {
      if (typeof window === 'undefined') return;
      if (typeof to === 'number') { window.history.go(to); return; }
      window.location.href = to;
    };
    return (
      <AppLayoutRouterFallback pathname={pathname} navigate={navigate}>
        {children}
      </AppLayoutRouterFallback>
    );
  }

  return <AppLayoutInner>{children}</AppLayoutInner>;
}

function AppLayoutRouterFallback({
  children,
  navigate,
  pathname,
}: {
  children: ReactNode;
  navigate: (to: string | number) => void;
  pathname: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
        event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleLogout = async () => { await signOut(); window.location.href = '/'; };
  const initials = profile?.name?.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const pageTitle = navItems.find((item) => pathname === item.path)?.label || '';

  return (
    <AppShell>
      <div className="flex min-h-dvh w-full min-w-0 flex-1 flex-col overflow-x-clip bg-background lg:flex-row">
        <ConnectedRosterLifecycle />

        {/* Desktop sidebar */}
        <aside className="hidden w-[248px] shrink-0 flex-col border-b border-border bg-card safe-area-top safe-area-bottom dark:border-border dark:bg-card/50 lg:sticky lg:top-0 lg:flex lg:h-screen lg:min-h-dvh lg:border-b-0 lg:border-r lg:border-border lg:shadow-sm">
          <div className="flex h-16 items-center gap-3 border-b border-border px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-sm">
              <Plane className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-foreground">EscalaX</span>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const active = pathname === item.path;
              return (
                <a key={item.path} href={item.path} className={desktopNavLinkClass(active)}>
                  <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-sidebar-primary-foreground' : ''}`} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
          <div className="space-y-2 border-t border-border p-3">
            {profile && (
              <a href="/profile" className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-secondary transition-colors">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={profile.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{profile.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{profile.airline || profile.email}</p>
                </div>
              </a>
            )}
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip bg-background">
          {/* Mobile top header */}
          {mainTabPaths.has(pathname) ? (
            <header className="sticky top-0 z-40 h-11 px-4 flex items-center justify-between bg-card/95 backdrop-blur-xl border-b border-border lg:hidden safe-area-top">
              <div className="w-8" />
              <span className="text-[15px] font-semibold text-foreground">EscalaX</span>
              <a href="/notifications" className="relative p-1 text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </a>
            </header>
          ) : (
            <header className="sticky top-0 z-40 h-11 px-1 flex items-center bg-card/95 backdrop-blur-xl border-b border-border lg:hidden safe-area-top">
              <button
                onClick={() => navigate(-1)}
                className="p-2 text-primary hover:text-foreground rounded-lg transition-colors shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="flex-1 text-center text-[15px] font-semibold text-foreground pr-9 truncate">
                {pageTitle || 'EscalaX'}
              </span>
            </header>
          )}

          {/* Desktop top header */}
          <header className="hidden h-[4.25rem] items-center justify-between border-b border-border/80 bg-card/90 px-4 backdrop-blur-xl dark:border-border dark:bg-card/30 sm:px-5 lg:flex lg:px-6 xl:px-8 2xl:px-12">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-foreground lg:text-3xl">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              <a
                href="/support"
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </a>
              <a
                href="/notifications"
                className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                )}
              </a>
              {profile && (
                <a
                  href="/profile"
                  className="ml-1 flex items-center gap-2 rounded-xl border border-transparent py-1 pl-1 pr-2 transition-colors hover:border-slate-200 hover:bg-slate-50 dark:hover:border-border dark:hover:bg-secondary"
                >
                  <Avatar className="h-9 w-9 border border-slate-200/80 shadow-sm dark:border-border">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-800 xl:inline dark:text-foreground">
                    {profile.name}
                  </span>
                </a>
              )}
            </div>
          </header>

          {/* Mobile drawer */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetContent side="right" className="w-[85vw] max-w-[320px] bg-background border-border p-0 flex flex-col max-h-dvh">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              {profile && (
                <a
                  href="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-4 px-5 py-5 border-b border-border bg-card safe-area-top shrink-0"
                >
                  <Avatar className="w-14 h-14 shrink-0">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground truncate">{profile.name?.toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground truncate">{profile.airline || ''}</p>
                  </div>
                </a>
              )}
              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {navItems.map((item) => {
                  const active = pathname === item.path;
                  return (
                    <a
                      key={item.path}
                      href={item.path}
                      onClick={() => setDrawerOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      {item.label}
                    </a>
                  );
                })}
                <a
                  href="/support"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground/70 hover:bg-secondary hover:text-foreground"
                >
                  <HelpCircle className="w-[18px] h-[18px] shrink-0 text-muted-foreground" /> Suporte
                </a>
              </nav>
              <div className="px-3 py-3 border-t border-border safe-area-bottom">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive/80 hover:bg-destructive/8 hover:text-destructive transition-colors w-full"
                >
                  <LogOut className="w-[18px] h-[18px] shrink-0" /> Sair da conta
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <main className="flex min-h-0 flex-1 overflow-x-hidden overflow-y-visible bg-background">
            <div className="w-full max-w-none px-3 py-5 pb-safe-content sm:px-4 sm:py-6 md:px-5 md:py-7 lg:px-6 lg:py-8 xl:px-8 2xl:px-12 safe-area-bottom">
              {children}
            </div>
          </main>

          <FeedbackFAB open={feedbackOpen} onOpenChange={setFeedbackOpen} hideTrigger />
          <PWAInstallPrompt />
        </div>

        <MobileBottomNav pathname={pathname} />
      </div>
    </AppShell>
  );
}
