import { jsPDF } from 'jspdf'
import type { EcrewRosterJson } from './ecrew-roster-types.ts'

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 5,
): number {
  const lines = doc.splitTextToSize(text, maxWidth)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

export function buildEscalaXRosterPdf(roster: EcrewRosterJson): Buffer {
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  let y = 18

  const ensureSpace = (needed = 12) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage()
      y = 18
    }
  }

  doc.setFontSize(18)
  doc.text('EscalaX', margin, y)
  y += 8

  doc.setFontSize(10)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, y)
  y += 10

  doc.setFontSize(14)
  doc.text('Voos', margin, y)
  y += 8

  if (!roster.flights || roster.flights.length === 0) {
    doc.setFontSize(10)
    doc.text('Nenhum voo encontrado.', margin, y)
    y += 8
  } else {
    roster.flights.forEach((flight, index) => {
      ensureSpace(30)

      doc.setFontSize(11)
      doc.text(`Voo ${index + 1}`, margin, y)
      y += 6

      doc.setFontSize(10)
      doc.text(`Data: ${flight.date ?? '-'}`, margin, y)
      y += 5
      doc.text(`Número: ${flight.flightNumber ?? '-'}`, margin, y)
      y += 5
      doc.text(`Origem: ${flight.origin ?? '-'}`, margin, y)
      y += 5
      doc.text(`Destino: ${flight.destination ?? '-'}`, margin, y)
      y += 5
      doc.text(`Saída: ${flight.departureTime ?? '-'}`, margin, y)
      y += 5
      doc.text(`Chegada: ${flight.arrivalTime ?? '-'}`, margin, y)
      y += 5

      y = addWrappedText(
        doc,
        `Texto bruto: ${flight.rawText ?? '-'}`,
        margin,
        y,
        contentWidth,
      )
      y += 6

      doc.line(margin, y - 2, pageWidth - margin, y - 2)
      y += 4
    })
  }

  ensureSpace(16)
  doc.setFontSize(14)
  doc.text('Folgas / Off', margin, y)
  y += 8

  if (!roster.daysOff || roster.daysOff.length === 0) {
    doc.setFontSize(10)
    doc.text('Nenhuma folga encontrada.', margin, y)
    y += 8
  } else {
    roster.daysOff.forEach((dayOff, index) => {
      ensureSpace(24)

      doc.setFontSize(11)
      doc.text(`Folga ${index + 1}`, margin, y)
      y += 6

      doc.setFontSize(10)
      doc.text(`Data: ${dayOff.date ?? '-'}`, margin, y)
      y += 5
      doc.text(`Tipo: ${dayOff.label ?? '-'}`, margin, y)
      y += 5

      y = addWrappedText(
        doc,
        `Texto bruto: ${dayOff.rawText ?? '-'}`,
        margin,
        y,
        contentWidth,
      )
      y += 6

      doc.line(margin, y - 2, pageWidth - margin, y - 2)
      y += 4
    })
  }

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}