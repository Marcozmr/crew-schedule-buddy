import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'accent' | 'success';
}

const variantStyles = {
  default: 'bg-card shadow-card',
  primary: 'gradient-sky text-primary-foreground',
  accent: 'gradient-sunset text-accent-foreground',
  success: 'bg-success text-success-foreground',
};

const iconVariantStyles = {
  default: 'bg-primary/10 text-primary',
  primary: 'bg-primary-foreground/20 text-primary-foreground',
  accent: 'bg-accent-foreground/20 text-accent-foreground',
  success: 'bg-success-foreground/20 text-success-foreground',
};

export function StatCard({ title, value, subtitle, icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-5 ${variantStyles[variant]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${variant === 'default' ? 'text-muted-foreground' : 'opacity-80'}`}>
            {title}
          </p>
          <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 ${variant === 'default' ? 'text-muted-foreground' : 'opacity-70'}`}>
              {subtitle}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconVariantStyles[variant]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
