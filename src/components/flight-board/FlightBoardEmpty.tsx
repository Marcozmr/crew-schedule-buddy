import { Plane } from "lucide-react";

interface FlightBoardEmptyProps {
  mode: "departure" | "arrival";
}

export function FlightBoardEmpty({ mode }: FlightBoardEmptyProps) {
  const label =
    mode === "departure"
      ? "Nenhuma partida encontrada"
      : "Nenhuma chegada encontrada";

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <Plane className="mb-3 h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
        Ajuste os filtros ou tente outra data para ver os voos
      </p>
    </div>
  );
}
