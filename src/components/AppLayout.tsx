import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Plane, LayoutDashboard, Calendar, Search, Menu, X, LogOut, Bell, User, Home, Download, FileText, FolderOpen, DollarSign, UtensilsCrossed, ArrowLeftRight, BedDouble, Clock, Cloud, Settings, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FeedbackFAB } from '@/components/FeedbackFAB';

const fullNav = [
  { path: '/home', label: 'Menu Principal', icon: Home },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/schedule', label: 'Escala', icon: Calendar },
  { path: '/download-roster', label: 'Baixar Escala', icon: Download },
  { path: '/documents', label: 'Documentos', icon: FolderOpen },
  { path: '/salary', label: 'Salário', icon: DollarSign },
  { path: '/perdiem', label: 'Diárias', icon: UtensilsCrossed },
  { path: '/flight-swap', label: 'Troca de Voo', icon: ArrowLeftRight },
  { path: '/rest-calc', label: 'Cálc. Descanso', icon: BedDouble },
  { path: '/duty-calc', label: 'Cálc. Jornada', icon: Clock },
  { path: '/weather', label: 'Clima', icon: Cloud },
  { path: '/search', label: 'Buscar Voos', icon: Search },
  { path: '/notifications', label: 'Notificações', icon: Bell },
  { path: '/regulation', label: 'Regulamentação', icon: FileText },
  { path: '/profile', label: 'Meu Perfil', icon: User },
  { path: '/settings', label: 'Ajustes', icon: Settings },
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
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false);
      setUnreadCount(count || 0);
    };
    load();
    const channel = supabase.channel('notif-badge').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleLogout = async () => { await signOut(); window.location.href = '/'; };
  const initials = profile?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const pageTitle = fullNav.find(n => location.pathname === n.path)?.label || '';

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-40 gradient-dark px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="text-primary-foreground p-1 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => navigate('/home')} className="text-primary-foreground p-1 hover:bg-white/10 rounded-lg transition-colors">
            <Home className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 ml-1">
            <div className="w-7 h-7 rounded-lg gradient-sky flex items-center justify-center">
              <Plane className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-primary-foreground hidden sm:inline">EscalaX</span>
            {pageTitle && <span className="text-sm text-primary-foreground/60 hidden sm:inline">/ {pageTitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/notifications" className="relative p-2 text-primary-foreground hover:bg-white/10 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && <span className="absolute top-1 right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>}
          </Link>
          <button onClick={() => setDrawerOpen(true)} className="text-primary-foreground p-2 hover:bg-white/10 rounded-lg transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile page title */}
      {pageTitle && (
        <div className="sm:hidden px-4 pt-3 pb-1">
          <h1 className="text-lg font-bold text-foreground">{pageTitle}</h1>
        </div>
      )}

      {/* Navigation Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-80 gradient-dark border-sidebar-border p-0">
          <SheetHeader className="p-4 border-b border-sidebar-border">
            <SheetTitle className="text-primary-foreground text-left">Navegação</SheetTitle>
          </SheetHeader>
          {profile && (
            <Link to="/profile" onClick={() => setDrawerOpen(false)} className="flex items-center gap-3 mx-4 mt-4 mb-2 p-3 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary-foreground truncate">{profile.name}</p>
                <p className="text-xs text-sidebar-foreground truncate">{profile.airline || profile.email}</p>
              </div>
            </Link>
          )}
          <nav className="p-4 space-y-0.5 overflow-y-auto max-h-[calc(100vh-220px)]">
            {fullNav.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-primary/20 text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {item.path === '/notifications' && unreadCount > 0 && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-all w-full">
              <LogOut className="w-4 h-4" />Sair
            </button>
            <p className="px-3 text-xs text-sidebar-foreground/50 mt-2">© {new Date().getFullYear()} EscalaX. Todos os direitos reservados.</p>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">{children}</div>
      </main>

      <FeedbackFAB />
    </div>
  );
}
