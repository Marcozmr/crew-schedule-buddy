import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { motion } from 'framer-motion';
import { Plane, Download, FileText, DollarSign, UtensilsCrossed, ArrowLeftRight, BedDouble, Clock, Cloud, Settings, LogOut } from 'lucide-react';
import airplaneBg from '@/assets/airplane-bg.jpg';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';

const menuItems = [
  { label: 'Escala', icon: Plane, path: '/schedule', color: 'from-orange-500 to-orange-600' },
  { label: 'Baixar Escala', icon: Download, path: '/download-roster', color: 'from-orange-500 to-orange-600' },
  { label: 'Escala PDF', icon: FileText, path: '/dashboard', color: 'from-orange-500 to-orange-600' },
  { label: 'Salário', icon: DollarSign, path: '#', color: 'from-orange-500 to-orange-600', soon: true },
  { label: 'Diárias', icon: UtensilsCrossed, path: '#', color: 'from-orange-500 to-orange-600', soon: true },
  { label: 'Troca de Voo', icon: ArrowLeftRight, path: '#', color: 'from-orange-500 to-orange-600', soon: true },
  { label: 'Cálculo Descanso', icon: BedDouble, path: '#', color: 'from-orange-500 to-orange-600', soon: true },
  { label: 'Cálculo Jornada', icon: Clock, path: '#', color: 'from-orange-500 to-orange-600', soon: true },
  { label: 'Clima', icon: Cloud, path: '#', color: 'from-orange-500 to-orange-600', soon: true },
  { label: 'Ajustes', icon: Settings, path: '/profile', color: 'from-orange-500 to-orange-600' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const initials = profile?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Background */}
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
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center shadow-lg">
            <Plane className="w-5 h-5 text-white" />
          </div>
        </div>
      </div>

      {/* Grid Menu */}
      <div className="relative z-10 flex-1 px-4 py-6 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          {menuItems.map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (item.soon) {
                  toast.info('Em breve!');
                  return;
                }
                navigate(item.path);
              }}
              className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-95 transition-all min-h-[100px] text-white"
            >
              <item.icon className="w-8 h-8" />
              <span className="text-xs font-semibold text-center leading-tight">{item.label}</span>
              {item.soon && (
                <span className="absolute top-1 right-1 bg-black/40 text-[9px] px-1.5 py-0.5 rounded-full text-white/80">Em breve</span>
              )}
            </motion.button>
          ))}

          {/* Logout button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: menuItems.length * 0.05 }}
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-95 transition-all min-h-[100px] text-white"
          >
            <LogOut className="w-8 h-8" />
            <span className="text-xs font-semibold">Logout</span>
          </motion.button>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-6 pt-2 flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-sky-400 flex items-center justify-center mb-2 shadow-elevated">
          <Plane className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">EscalaX</h2>
        <p className="text-white/40 text-xs mt-1">© {new Date().getFullYear()} Marcos Vinicius</p>
      </div>
    </div>
  );
}
