import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    const timer = window.setTimeout(() => {
      updateServiceWorker(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [needRefresh, updateServiceWorker]);

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed safe-bottom-6 left-1/2 -translate-x-1/2 z-[9999]"
        >
          <div className="glass border border-primary/20 shadow-lg px-5 py-3 flex items-center gap-3 rounded-2xl">
            <RefreshCw className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm font-medium text-foreground">Nova versão encontrada. Atualizando…</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
