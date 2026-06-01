import { rgb, StandardFonts, PDFDocument } from 'pdf-lib'
import type { RosterJson } from '../types.ts'

type Column = {
  label: string
  width: number
}

type TableRow = string[]

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

function splitCellText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]

  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars) {
      if (current) lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : [text]
}

export async function buildEscalaXRosterPdf(roster: RosterJson): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 40
  const pageWidth = 595.28
  const pageHeight = 841.89
  const lineHeight = 14
  const tableHeaderHeight = 18
  const rowPadding = 4
  const generatedAt = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
  const monthYearLabel = inferMonthYearLabel(roster)

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
  }

  const drawHeader = () => {
    page.drawText('EscalaX', {
      x: margin,
      y,
      size: 24,
      font: fontBold,
      color: rgb(0.06, 0.46, 0.43),
    })
    y -= 24

    page.drawText(`Escala de ${monthYearLabel}`, {
      x: margin,
      y,
      size: 12,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    })
    y -= 22
  }

  const drawSectionTitle = (title: string) => {
    ensureSpace(24)
    page.drawText(title, {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.07, 0.07, 0.07),
    })
    y -= 18
  }

  const drawTable = (columns: Column[], rows: TableRow[], emptyMessage: string) => {
    const tableWidth = pageWidth - margin * 2
    const colX: number[] = []
    let runningX = margin
    for (const col of columns) {
      colX.push(runningX)
      runningX += col.width
    }

    const drawHeaderRow = () => {
      ensureSpace(tableHeaderHeight + rowPadding)

      page.drawRectangle({
        x: margin,
        y: y - tableHeaderHeight + 2,
        width: tableWidth,
        height: tableHeaderHeight,
        color: rgb(0.94, 0.95, 0.96),
      })

      columns.forEach((col, idx) => {
        page.drawText(col.label, {
          x: colX[idx] + 4,
          y: y - 12,
          size: 10,
          font: fontBold,
          color: rgb(0.11, 0.11, 0.11),
        })
      })

      y -= tableHeaderHeight
      page.drawLine({
        start: { x: margin, y: y + 2 },
        end: { x: margin + tableWidth, y: y + 2 },
        thickness: 1,
        color: rgb(0.7, 0.7, 0.7),
      })
    }

    drawHeaderRow()

    if (!rows.length) {
      ensureSpace(20)
      page.drawText(emptyMessage, {
        x: margin + 4,
        y: y - 12,
        size: 10,
        font: fontRegular,
        color: rgb(0.35, 0.35, 0.35),
      })
      y -= 20
      return
    }

    for (const row of rows) {
      const wrappedCells = row.map((cell, idx) =>
        splitCellText(cell, Math.max(8, Math.floor(columns[idx].width / 6))),
      )
      const rowLines = Math.max(...wrappedCells.map((cell) => cell.length))
      const rowHeight = rowLines * lineHeight + rowPadding

      ensureSpace(rowHeight + 8)

      for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
        const cellLines = wrappedCells[colIdx] ?? ['']
        cellLines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: colX[colIdx] + 4,
            y: y - 12 - lineIndex * lineHeight,
            size: 10,
            font: fontRegular,
            color: rgb(0.15, 0.15, 0.15),
          })
        })
      }

      y -= rowHeight
      page.drawLine({
        start: { x: margin, y: y + 2 },
        end: { x: margin + tableWidth, y: y + 2 },
        thickness: 0.7,
        color: rgb(0.82, 0.82, 0.82),
      })
    }
  }

  drawHeader()

  drawSectionTitle('Voos')
  drawTable(
    [
      { label: 'Data', width: 85 },
      { label: 'Voo', width: 70 },
      { label: 'Trecho', width: 210 },
      { label: 'Horarios', width: 150 },
    ],
    roster.flights.map((flight) => [
      flight.date,
      flight.flightNumber,
      `${flight.origin} -> ${flight.destination}`,
      `${flight.departureTime} - ${flight.arrivalTime}`,
    ]),
    'Nenhum voo encontrado.',
  )

  y -= 20

  drawSectionTitle('Folgas / Reservas')
  drawTable(
    [
      { label: 'Data', width: 85 },
      { label: 'Tipo', width: 120 },
      { label: 'Texto bruto', width: 310 },
    ],
    roster.daysOff.map((dayOff) => [dayOff.date, dayOff.type, dayOff.rawText]),
    'Nenhuma folga ou reserva encontrada.',
  )

  ensureSpace(24)
  page.drawText(`Gerado em: ${generatedAt}`, {
    x: margin,
    y: margin - 8,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  })

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
