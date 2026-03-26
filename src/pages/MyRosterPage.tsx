import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { RosterConnectionBanner } from "@/components/roster/RosterConnectionBanner";
import { CorporateRosterFlowBanner } from "@/components/roster/CorporateRosterFlowBanner";
import { Calendar } from "lucide-react";

/**
 * Minha escala — status da escala ativa, última atualização, download PDF e reimportação.
 * Conteúdo operacional do dia permanece no Dashboard.
 */
export default function MyRosterPage() {
  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold text-foreground lg:text-2xl">Minha escala</h1>
          <p className="text-sm text-muted-foreground">
            Aqui você acompanha a escala importada, baixa o PDF e atualiza os dados. O resumo do seu dia
            operacional fica no{" "}
            <Link to="/dashboard" className="font-medium text-primary hover:underline">
              Dashboard
            </Link>
            .
          </p>
        </div>

        <CorporateRosterFlowBanner />
        <RosterConnectionBanner />

        <Link
          to="/schedule"
          className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/50 px-4 py-3 text-sm text-foreground transition-colors hover:bg-muted/50"
        >
          <Calendar className="h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="font-medium">Calendário da escala</span>
            <span className="block text-xs text-muted-foreground">Visualização mensal e detalhes por dia</span>
          </span>
        </Link>
      </div>
    </AppLayout>
  );
}
