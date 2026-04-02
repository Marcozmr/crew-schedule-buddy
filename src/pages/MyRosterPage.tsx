import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageSection, SurfacePanel } from "@/components/presentation/PremiumChrome";
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
      <PageSection className="pb-12">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-foreground lg:text-3xl">
            Minha escala
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Aqui você acompanha a escala importada, baixa o PDF e atualiza os dados. O resumo do seu dia
            operacional fica no{" "}
            <Link to="/dashboard" className="font-medium text-primary hover:underline">
              Dashboard
            </Link>
            .
          </p>
        </div>

        <SurfacePanel className="space-y-5 p-5 md:p-7">
          <CorporateRosterFlowBanner />
          <RosterConnectionBanner />
        </SurfacePanel>

        <Link
          to="/schedule"
          className="glass-elevated flex items-center gap-4 rounded-[var(--radius-card,1.25rem)] px-5 py-4 text-sm text-foreground transition-colors hover:bg-muted/30"
        >
          <Calendar className="h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">Calendário da escala</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Visualização mensal e detalhes por dia
            </span>
          </span>
        </Link>
      </PageSection>
    </AppLayout>
  );
}
