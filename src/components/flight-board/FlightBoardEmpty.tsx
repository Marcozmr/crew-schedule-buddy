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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center sm:px-6 sm:py-12">
      <Plane className="mb-3 h-10 w-10 text-muted-foreground/35" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-2 max-w-[min(100%,320px)] text-xs leading-relaxed text-muted-foreground">
        Nada a exibir com os filtros atuais. Tente outra data, outro aeroporto no seletor ou limpe companhia/número do
        voo.
      </p>
    </div>
  );
}
