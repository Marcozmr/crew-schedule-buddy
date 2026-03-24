/**
 * Destino do manifest share_target (POST multipart). Muitos hosts estáticos não
 * encaminham POST para a SPA — o fluxo principal no web é PWA + file_handlers + LaunchQueueHandler.
 * Em Android com PWA instalado, “Compartilhar” pode abrir esta rota; o arquivo costuma
 * exigir suporte do servidor ou SW dedicado.
 */
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ShareImportPlaceholderPage() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
      <Share2 className="w-12 h-12 text-primary mb-4" />
      <h1 className="text-lg font-semibold text-foreground mb-2">Compartilhar com EscalaX</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Para receber PDFs pelo sistema de compartilhamento do celular, instale o EscalaX como app (PWA) e use
        também <span className="font-medium text-foreground">Abrir com EscalaX</span> em arquivos CrewRosterReport,
        quando o navegador oferecer.
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        Enquanto isso, use <span className="font-medium">Usar último CrewRosterReport</span> ou importe o PDF na aba
        Fontes de escala.
      </p>
      <Button asChild>
        <Link to="/download-roster">Ir para Fontes de escala</Link>
      </Button>
    </div>
  );
}
