export function AppFooter({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-muted-foreground/50 ${className}`}>
      © {new Date().getFullYear()} EscalaX. Desenvolvido por Marcos Vinicius.
    </p>
  );
}
