/** Itens de navegação do app (menu lateral e barra de baixo). */
import { LayoutDashboard, Calendar, Clock, BedDouble, Shield, Settings, CalendarClock, Users, Home, BarChart3, Banknote } from 'lucide-react';

export const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/minha-escala', label: 'Minha escala', icon: CalendarClock },
  { path: '/schedule', label: 'Calendário da escala', icon: Calendar },
  { path: '/connections', label: 'Conexões', icon: Users },
  { path: '/duty-calc', label: 'Calcular jornada', icon: Clock },
  { path: '/rest-calc', label: 'Calcular descanso', icon: BedDouble },
  { path: '/regulation', label: 'Calculadora operacional', icon: Shield },
  { path: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
  { path: '/settings', label: 'Configurações', icon: Settings },
];

export const bottomNavItems = [
  { path: '/dashboard', label: 'Início', icon: Home },
  { path: '/schedule', label: 'Escala', icon: Calendar },
  { path: '/connections', label: 'Conexões', icon: Users },
  { path: '/estatisticas', label: 'Estatísticas', icon: BarChart3 },
  { path: '/salary', label: 'Salário', icon: Banknote },
  { path: '/settings', label: 'Ajustes', icon: Settings },
];

export const mainTabPaths = new Set(['/dashboard', '/schedule', '/connections', '/estatisticas', '/salary', '/settings']);
