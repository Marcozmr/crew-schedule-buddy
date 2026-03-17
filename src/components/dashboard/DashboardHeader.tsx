/**
 * EFB Dashboard — User Header
 * Professional crew member identification bar.
 */

import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface DashboardHeaderProps {
  unreadCount?: number;
}

export function DashboardHeader({ unreadCount = 0 }: DashboardHeaderProps) {
  const { profile } = useAuth();
  const initials = profile?.name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Link to="/profile">
          <Avatar className="w-11 h-11 border-2 border-primary/30">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-xs font-bold bg-primary/20 text-primary">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{greeting}</p>
          <h1 className="text-base font-bold text-foreground leading-tight">{profile?.name || 'Tripulante'}</h1>
          {profile?.airline && (
            <p className="text-[10px] text-efb-text-dim font-mono">{profile.airline}{profile?.registration ? ` • ${profile.registration}` : ''}</p>
          )}
        </div>
      </div>
      <Link to="/notifications" className="relative p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors">
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{unreadCount}</span>
        )}
      </Link>
    </motion.div>
  );
}
