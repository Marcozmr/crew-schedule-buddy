import React, { useEffect, useState } from "react";

type FlightResult = {
  id: string;
  flightNumber: string;
  carrierCode: string;
  origin: string;
  destination: string;
  departure: {
    scheduled: string | null;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
  };
  arrival: {
    scheduled: string | null;
    actual: string | null;
    terminal: string | null;
    gate: string | null;
  };
  aircraftCode: string | null;
  status: string;
};

export default function FlightStatusPanel() {
  const [airportCode, setAirportCode] = useState("GRU");
  const [carrierCode, setCarrierCode] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flights, setFlights] = useState<FlightResult[]>([]);
  const [updated, setUpdated] = useState("");

  async function loadFlights(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (!baseUrl || !anonKey) {
        throw new Error("Variáveis do Supabase não encontradas");
      }

      const params = new URLSearchParams();

      if (airportCode.trim()) {
        params.set("airportCode", airportCode.trim().toUpperCase());
      }

      if (carrierCode.trim()) {
        params.set("carrierCode", carrierCode.trim().toUpperCase());
      }

      if (flightNumber.trim()) {
        params.set("flightNumber", flightNumber.trim());
      }

      if (date.trim()) {
        params.set("scheduledDepartureDate", date.trim());
      }

      const response = await fetch(
        `${baseUrl}/functions/v1/flight-status?${params.toString()}`,
        {
          method: "GET",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro na consulta");
      }

      setFlights(data.flights || []);
      setUpdated(data.lastUpdatedAt || "");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao consultar voo";
      setError(message);
      console.error("Erro no painel de voos:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlights();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <h2 className="mb-3 text-xl font-semibold text-foreground">Painel de voos</h2>

      <form onSubmit={loadFlights} className="grid gap-3 md:grid-cols-5">
        <input
          placeholder="Aeroporto (GRU, CGH, BSB)"
          value={airportCode}
          onChange={(e) => setAirportCode(e.target.value.toUpperCase())}
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />

        <input
          placeholder="Companhia (LA / G3 / AD)"
          value={carrierCode}
          onChange={(e) => setCarrierCode(e.target.value.toUpperCase())}
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />

        <input
          placeholder="Número do voo"
          value={flightNumber}
          onChange={(e) => setFlightNumber(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground"
        />

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-foreground"
        />

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Consultar"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">{error}</div>
      )}

      {!error && flights.length === 0 && !loading && (
        <div className="mt-4 rounded-md bg-muted p-3 text-muted-foreground">
          Nenhum voo encontrado.
        </div>
      )}

      <div className="mt-4 space-y-4">
        {flights.map((flight) => (
          <div key={flight.id} className="rounded-xl border border-border bg-background/50 p-4">
            <div className="flex justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">{flight.flightNumber}</div>
                <div className="text-sm text-muted-foreground">
                  {flight.origin} → {flight.destination}
                </div>
              </div>

              <div className="rounded border border-border px-3 py-1 text-sm text-foreground">
                {flight.status}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <b>Partida</b>
                <div>Programado: {flight.departure.scheduled || "-"}</div>
                <div>Real: {flight.departure.actual || "-"}</div>
                <div>Terminal: {flight.departure.terminal || "-"}</div>
                <div>Gate: {flight.departure.gate || "-"}</div>
              </div>

              <div>
                <b>Chegada</b>
                <div>Programado: {flight.arrival.scheduled || "-"}</div>
                <div>Real: {flight.arrival.actual || "-"}</div>
                <div>Terminal: {flight.arrival.terminal || "-"}</div>
                <div>Gate: {flight.arrival.gate || "-"}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {updated && (
        <div className="mt-3 text-xs text-muted-foreground">
          Atualizado: {new Date(updated).toLocaleString("pt-BR")}
        </div>
      )}
    </div>
  );
}