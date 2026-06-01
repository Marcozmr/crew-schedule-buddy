import type { RosterJson } from '../types.ts'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function inferMonthYearLabel(roster: RosterJson): string {
  const firstDate = roster.flights[0]?.date ?? roster.daysOff[0]?.date
  if (!firstDate) return 'Escala'

  const parsed = new Date(`${firstDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return 'Escala'

  return parsed.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function buildEscalaXRosterHtml(roster: RosterJson): string {
  const monthYear = inferMonthYearLabel(roster)
  const generatedAt = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })

  const flightsRows = roster.flights.length
    ? roster.flights
        .map(
          (flight) => `
          <tr>
            <td>${escapeHtml(flight.date)}</td>
            <td>${escapeHtml(flight.flightNumber)}</td>
            <td>${escapeHtml(`${flight.origin} → ${flight.destination}`)}</td>
            <td>${escapeHtml(`${flight.departureTime} - ${flight.arrivalTime}`)}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="4">Nenhum voo encontrado.</td></tr>'

  const daysOffRows = roster.daysOff.length
    ? roster.daysOff
        .map(
          (dayOff) => `
          <tr>
            <td>${escapeHtml(dayOff.date)}</td>
            <td>${escapeHtml(dayOff.type)}</td>
            <td>${escapeHtml(dayOff.rawText)}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="3">Nenhuma folga ou reserva encontrada.</td></tr>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EscalaX - ${escapeHtml(monthYear)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    header { margin-bottom: 18px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; }
    .logo { font-size: 24px; font-weight: 700; color: #0f766e; }
    .subtitle { font-size: 14px; color: #4b5563; margin-top: 4px; }
    h2 { font-size: 18px; margin: 20px 0 8px; color: #111827; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 600; }
    footer { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <header>
    <div class="logo">EscalaX</div>
    <div class="subtitle">Escala de ${escapeHtml(monthYear)}</div>
  </header>

  <main>
    <h2>Voos</h2>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Voo</th>
          <th>Trecho</th>
          <th>Horários</th>
        </tr>
      </thead>
      <tbody>${flightsRows}</tbody>
    </table>

    <h2>Folgas / Reservas</h2>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Detalhe</th>
        </tr>
      </thead>
      <tbody>${daysOffRows}</tbody>
    </table>
  </main>

  <footer>Gerado em: ${escapeHtml(generatedAt)}</footer>
</body>
</html>`
}
