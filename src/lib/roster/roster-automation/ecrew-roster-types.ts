export interface EcrewRosterFlightRow {
  date: string | null
  flightNumber: string | null
  origin: string | null
  destination: string | null
  departureTime: string | null
  arrivalTime: string | null
  rawText: string
}

export interface EcrewRosterDayOffRow {
  date: string | null
  label: string | null
  rawText: string
}

export interface EcrewRosterJson {
  extractedAt: string
  flights: EcrewRosterFlightRow[]
  daysOff: EcrewRosterDayOffRow[]
}

export interface CaptureRosterResult {
  rosterJson: EcrewRosterJson
  pdfBuffer: Buffer
  /** Caminho gravado em disco quando a escrita em `.playwright/` tem sucesso. */
  pdfPath: string | null
}
