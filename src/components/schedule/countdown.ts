/** "em 3h03", "em 45 min", "em 3 dias" ou "agora". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'agora';
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `em ${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  if (hours < 48) return `em ${hours}h${String(totalMin % 60).padStart(2, '0')}`;
  return `em ${Math.floor(hours / 24)} dias`;
}
