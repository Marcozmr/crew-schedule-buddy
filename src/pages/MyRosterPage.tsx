import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AppCard, AppCardSection, SectionLabel } from "@/components/ui/primitives";
import { RosterConnectionBanner } from "@/components/roster/RosterConnectionBanner";
import { CorporateRosterFlowBanner } from "@/components/roster/CorporateRosterFlowBanner";
import { RosterSourcesCard } from "@/components/roster/RosterSourcesCard";
import { Calendar, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.28, ease: "easeOut" as const },
});

export default function MyRosterPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl space-y-5 pb-12">

        {/* Banners de conexão */}
        <motion.div {...fade(0)} className="space-y-3">
          <CorporateRosterFlowBanner />
          <RosterConnectionBanner />
        </motion.div>

        {/* Fontes da escala */}
        <motion.div {...fade(0.06)}>
          <SectionLabel>Fontes da escala</SectionLabel>
          <RosterSourcesCard />
        </motion.div>

        {/* Link para calendário */}
        <motion.div {...fade(0.1)}>
          <Link to="/schedule">
            <AppCard className="transition-colors hover:bg-secondary/20 active:bg-secondary/40">
              <AppCardSection className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Calendário da escala</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Visualização mensal e detalhes por dia</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              </AppCardSection>
            </AppCard>
          </Link>
        </motion.div>

      </div>
    </AppLayout>
  );
}
