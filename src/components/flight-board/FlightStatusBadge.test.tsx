import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlightStatusBadge } from "./FlightStatusBadge";

describe("FlightStatusBadge", () => {
  it("aplica fundo, texto e borda do status", () => {
    render(<FlightStatusBadge statusKey="delayed" label="Atrasado" />);

    const badge = screen.getByText("Atrasado");
    expect(badge.className).toContain("bg-warning/15");
    expect(badge.className).toContain("text-warning");
    expect(badge.className).toContain("border-warning/40");
  });

  it("usa o estilo neutro para status desconhecido", () => {
    render(<FlightStatusBadge statusKey={"sem_mapeamento" as never} label="Sem dados" />);

    expect(screen.getByText("Sem dados").className).toContain("bg-muted/80");
  });
});
