import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActiveRosterDownload } from '@/hooks/useActiveRosterDownload';

interface ActiveRosterDownloadButtonProps {
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  label?: string;
}

export function ActiveRosterDownloadButton({
  variant = 'outline',
  size = 'default',
  className,
  label = 'Baixar escala atual',
}: ActiveRosterDownloadButtonProps) {
  const { downloading, downloadCurrent } = useActiveRosterDownload();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={downloading}
      onClick={() => void downloadCurrent()}
    >
      <Download className={`w-4 h-4 mr-2 ${downloading ? 'opacity-50' : ''}`} />
      {label}
    </Button>
  );
}
