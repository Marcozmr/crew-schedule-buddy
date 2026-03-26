import "./index.css";
import {
  registerBootErrorListeners,
  unregisterBootServiceWorkers,
  clearStaleWebCaches,
} from "./lib/boot";
import { logEnvValidationOnBoot } from "./lib/envCheck";

registerBootErrorListeners();
console.log("[EscalaX boot] boot start");
console.log("[EscalaX boot] build id:", __ESCALAX_BUILD_ID__);
logEnvValidationOnBoot();

void (async () => {
  try {
    await unregisterBootServiceWorkers();
    await clearStaleWebCaches();
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
    console.error("EscalaX boot: falha ao carregar módulos da aplicação:", e);
    document.body.insertAdjacentHTML(
      "beforeend",
      '<p style="padding:1rem;font-family:system-ui,sans-serif">Erro ao carregar o EscalaX. Recarregue a página ou limpe o cache do navegador.</p>',
    );
  }
})();
