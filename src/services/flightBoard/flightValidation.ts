/**
 * Validação de dados de voo para garantir consistência operacional
 * Se dado não for confiável: não mostrar
 */

import type { FlightRaw } from "./types";

const IATA_CODE_REGEX = /^[A-Z0-9]{3}$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFlightData(raw: FlightRaw, airportCode: string): ValidationResult {
  const errors: string[] = [];

  if (!raw.flightNumber || typeof raw.flightNumber !== "string" || raw.flightNumber === "-") {
    errors.push("Número do voo ausente");
  } else {
    const fn = raw.flightNumber.replace(/\s/g, "");
    if (fn.length < 3 || fn.length > 10) errors.push("Número do voo inválido");
  }

  if (!raw.origin || typeof raw.origin !== "string" || raw.origin === "-") {
    errors.push("Origem inválida");
  } else if (!IATA_CODE_REGEX.test(raw.origin)) {
    errors.push("Código de origem inválido");
  }

  if (!raw.destination || typeof raw.destination !== "string" || raw.destination === "-") {
    errors.push("Destino inválido");
  } else if (!IATA_CODE_REGEX.test(raw.destination)) {
    errors.push("Código de destino inválido");
  }

  if (!raw.carrierCode || raw.carrierCode === "-") {
    errors.push("Companhia inválida");
  }

  const dep = raw.departure;
  const arr = raw.arrival;
  const scheduledTime = dep?.scheduled ?? arr?.scheduled;
  if (!scheduledTime || typeof scheduledTime !== "string") {
    errors.push("Horário programado ausente");
  } else {
    const timeMatch = scheduledTime.match(/^(\d{1,2}):(\d{2})/);
    if (!timeMatch) errors.push("Horário programado em formato inválido");
    else {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      if (h < 0 || h > 23 || m < 0 || m > 59) errors.push("Horário programado inválido");
    }
  }

  const isDeparture = raw.origin?.toUpperCase() === airportCode?.toUpperCase();
  const isArrival = raw.destination?.toUpperCase() === airportCode?.toUpperCase();
  if (!isDeparture && !isArrival) {
    errors.push("Voo não pertence ao aeroporto selecionado");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
