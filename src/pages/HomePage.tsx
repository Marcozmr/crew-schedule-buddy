import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useScheduleData } from '@/hooks/useScheduleData';
import { checkCompliance } from '@/lib/rbac117';
import { motion } from 'framer-motion';
import { Plane, Download, FileText, FolderOpen, DollarSign, UtensilsCrossed, ArrowLeftRight, BedDouble, Clock, Cloud, Settings, LogOut, ShieldCheck, ShieldAlert, ShieldX, ChevronRight } from 'lucide-react';
import airplaneBg from '@/assets/airplane-bg.jpg';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useMemo } from 'react';

const menuItems = [
  { label: 'Escala', icon: Plane, path: '/schedule', color: 'from-primary to-sky-500' },
  { label: 'Baixar Escala', icon: Download, path: '/download-roster', color: 'from-primary to-sky-500' },
  { label: 'Escala PDF', icon: FileText, path: '/dashboard', color: 'from-primary to-sky-500' },
  { label: 'Documentos', icon: FolderOpen, path: '/documents', color: 'from-primary to-sky-500' },
  { label: 'Salário', icon: DollarSign, path: '/salary', color: 'from-primary to-sky-500' },
  { label: 'Diárias', icon: UtensilsCrossed, path: '/perdiem', color: 'from-primary to-sky-500' },
  { label: 'Troca de Voo', icon: ArrowLeftRight, path: '/flight-swap', color: 'from-primary to-sky-500' },
  { label: 'Cálc. Descanso', icon: BedDouble, path: '/rest-calc', color: 'from-primary to-sky-500' },
  { label: 'Cálc. Jornada', icon: Clock, path: '/duty-calc', color: 'from-primary to-sky-500' },
  { label: 'Clima', icon: Cloud, path: '/weather', color: 'from-primary to-sky-500' },
  { label: 'Ajustes', icon: Settings, path: '/settings', color: 'from-primary to-sky-500' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { schedule } = useScheduleData();

  const compliance = useMemo(() => checkCompliance(schedule), [schedule]);
  const compIcon = compliance.status === 'regular' ? ShieldCheck : compliance.status === 'atencao' ? ShieldAlert : ShieldX;
  const compColor = compliance.status === 'regular' ? 'text-success' : compliance.status === 'atencao' ? 'text-yellow-400' : 'text-destructive';
  const compBg = compliance.status === 'regular' ? 'bg-success/20' : compliance.status === 'atencao' ? 'bg-yellow-500/20' : 'bg-destructive/20';
  const CompIcon = compIcon;

  const initials = profile?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

  const stats = useMemo(() => {
    const now = new Date();
    const flights = schedule.filter(e => e.is_flight && new Date(e.date.includes('-') && e.date.indexOf('-') === 4 ? e.date : e.date.split(/[\/\-]/).reverse().join('-')).getMonth() === now.getMonth());
    const hours = flights.reduce((s, e) => s + (e.flight_hours || 0), 0);
    const flightDays = new Set(flights.map(e => e.date)).size;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return { flights: flights.length, hours: Math.round(hours * 10) / 10, flightDays, daysOff: daysInMonth - flightDays };
  }, [schedule]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      <img src={airplaneBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-white/30">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/30 text-primary-foreground text-sm font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-semibold text-sm">{profile?.name || 'Tripulante'}</p>
            <p className="text-white/60 text-xs">{profile?.airline || 'EscalaX'}</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center shadow-lg">
          <Plane className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="relative z-10 px-4 py-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[80px] text-center shrink-0">
            <p className="text-white/60 text-[10px]">Voos</p>
            <p className="text-white font-bold text-lg">{stats.flights}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[80px] text-center shrink-0">
            <p className="text-white/60 text-[10px]">Horas</p>
            <p className="text-white font-bold text-lg">{stats.hours}h</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[80px] text-center shrink-0">
            <p className="text-white/60 text-[10px]">Dias Voo</p>
            <p className="text-white font-bold text-lg">{stats.flightDays}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[80px] text-center shrink-0">
            <p className="text-white/60 text-[10px]">Folgas</p>
            <p className="text-white font-bold text-lg">{stats.daysOff}</p>
          </div>
        </div>
      </div>

      {/* Regulation Badge */}
      {schedule.length > 0 && (
        <div className="relative z-10 px-4 py-1">
          <button onClick={() => navigate('/regulation')} className={`w-full flex items-center gap-3 ${compBg} backdrop-blur-sm rounded-xl px-4 py-2.5 transition-all hover:scale-[1.01] active:scale-[0.99]`}>
            <CompIcon className={`w-5 h-5 ${compColor}`} />
            <div className="flex-1 text-left">
              <p className="text-white text-sm font-semibold">RBAC 117: {compliance.label}</p>
              {compliance.alerts.length > 0 && (
                <p className="text-white/60 text-xs">{compliance.alerts.length} alerta{compliance.alerts.length > 1 ? 's' : ''} ativo{compliance.alerts.length > 1 ? 's' : ''}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-white/40" />
          </button>
        </div>
      )}

      {/* Grid Menu */}
      <div className="relative z-10 flex-1 px-4 py-4 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          {menuItems.map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-primary to-sky-500 shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-95 transition-all min-h-[90px] text-white"
            >
              <item.icon className="w-7 h-7" />
              <span className="text-[11px] font-semibold text-center leading-tight">{item.label}</span>
            </motion.button>
          ))}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: menuItems.length * 0.03 }}
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/10 backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-95 transition-all min-h-[90px] text-white"
          >
            <LogOut className="w-7 h-7" />
            <span className="text-[11px] font-semibold">Sair</span>
          </motion.button>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-4 pt-1 flex flex-col items-center">
        <h2 className="text-xl font-extrabold text-white tracking-tight">EscalaX</h2>
        <p className="text-white/40 text-[10px] mt-0.5">© {new Date().getFullYear()} Marcos Vinicius</p>
      </div>
    </div>
  );
}
