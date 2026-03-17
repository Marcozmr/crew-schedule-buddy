/**
 * PWA Update Prompt — detects new service worker and prompts user to reload.
 * Works with registerType: "prompt" from vite-plugin-pwa.
 */

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Check for updates every 60 seconds
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

  const handleUpdate = () => {
    updateServiceWorker(true);
  };

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]"
        >
          <div className="glass border border-primary/20 shadow-lg px-5 py-3 flex items-center gap-3 rounded-2xl">
            <RefreshCw className="w-4 h-4 text-primary animate-spin" />
            <span className="text-sm font-medium text-foreground">
              Nova versão disponível
            </span>
            <Button
              size="sm"
              onClick={handleUpdate}
              className="h-8 px-4 text-xs"
            >
              Atualizar agora
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
