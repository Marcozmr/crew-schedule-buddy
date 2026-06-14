import "./index.css";
import {
  registerAppRecoveryHandlers,
  isRecoverableLoadFailureMessage,
  handleRecoverableFailure,
  showHardRecoveryFallback,
  RECOVERY_SESSION_KEY,
} from "@/lib/app-recovery/appRecoveryManager";
import { runStorageMigrationOnBoot } from "@/lib/storageMigrationManager";
import { getEscalaxBuildId } from "@/lib/build-id";
import { initSentry } from "@/lib/monitoring/initSentry";
import { reportUnexpectedError } from "@/lib/monitoring/errorReporting";
import { logEnvValidationOnBoot } from "./lib/envCheck";

initSentry();
registerAppRecoveryHandlers();
if (import.meta.env.DEV) {
  console.log("[EscalaX boot] build id:", getEscalaxBuildId());
}
logEnvValidationOnBoot();
runStorageMigrationOnBoot();

void (async () => {
  try {
    const [{ createRoot }, { default: App }, { AppErrorBoundary }] = await Promise.all([
      import("react-dom/client"),
      import("./App.tsx"),
      import("./components/system/AppErrorBoundary.tsx"),
    ]);
    const rootEl = document.getElementById("root");
    if (!rootEl) {
      console.error("EscalaX: elemento #root ausente no DOM.");
      document.body.insertAdjacentHTML(
        "beforeend",
        '<p style="padding:1rem;font-family:system-ui,sans-serif">Não foi possível iniciar a aplicação. Recarregue a página.</p>',
      );
      return;
    }
    createRoot(rootEl).render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>,
    );
  } catch (e) {
    reportUnexpectedError(e, { flow: "main_bootstrap" });
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[EscalaX boot] falha ao carregar módulos:", e);
    if (isRecoverableLoadFailureMessage(msg)) {
      await handleRecoverableFailure("main-bootstrap", msg.slice(0, 400));
      return;
    }
    try {
      if (sessionStorage.getItem(RECOVERY_SESSION_KEY) === "1") {
        sessionStorage.removeItem(RECOVERY_SESSION_KEY);
        showHardRecoveryFallback();
        return;
      }
    } catch {
      /* ignore */
    }
    document.body.insertAdjacentHTML(
      "beforeend",
      '<p style="padding:1rem;font-family:system-ui,sans-serif">Erro ao carregar o EscalaX. Recarregue a página.</p>',
    );
  }
})();
