import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { ArrowLeft, Share2, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AppCard, AppCardSection } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function ConnectionSharePage() {
  const { profile, user } = useAuth();
  const [copied, setCopied] = useState(false);

  const shareUrl = user ? `${window.location.origin}/share/${user.id}` : '';

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: 'Minha escala — EscalaX',
        text: 'Acompanhe minha escala de voos no EscalaX',
        url: shareUrl,
      });
    } else {
      await copyLink();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <Link to="/connections" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Conexões
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15">
            <Share2 className="h-5 w-5 text-blue-500" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Compartilhar escala</h1>
            <p className="text-xs text-muted-foreground">Permita que familiares acompanhem seus voos</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <AppCard>
            <AppCardSection>
              {profile && (
                <div className="mb-4 flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <span className="text-sm font-bold text-primary">
                      {(profile.name || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{profile.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{profile.airline || 'Tripulante'}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={() => void shareNative()} className="flex-1 gap-2" size="sm">
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
                <Button onClick={() => void copyLink()} variant="outline" size="sm" className="gap-2">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado' : 'Copiar link'}
                </Button>
              </div>
            </AppCardSection>
          </AppCard>
        </motion.div>
      </div>
    </AppLayout>
  );
}
