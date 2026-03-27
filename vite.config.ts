import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(__dirname, "package.json"), "utf8")) as { version: string };

/** Muda a cada build (CI) ou inclui versão + sufixo local — força nomes de ficheiro e meta distintos. */
const escalaxBuildId =
  process.env.VITE_ESCALAX_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.CI_COMMIT_SHA?.slice(0, 12) ||
  `${pkg.version}-${Date.now().toString(36)}`;

function escalaxHtmlBuildMeta(): Plugin {
  const safe = String(escalaxBuildId).replace(/"/g, "'");
  return {
    name: "escalax-html-build-meta",
    transformIndexHtml(html) {
      return html.replace(
        "</head>",
        `  <meta name="escalax-build-id" content="${safe}" />\n  <meta http-equiv="Cache-Control" content="no-cache" />\n</head>`,
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: {
    __ESCALAX_BUILD_ID__: JSON.stringify(escalaxBuildId),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
      },
    },
  },
  plugins: [
    react(),
    escalaxHtmlBuildMeta(),
    mode === "development" && componentTagger(),
    VitePWA({
      /** Produção: SW + precache com hash; dev: sem SW ativo (devOptions.enabled false). */
      disable: false,
      devOptions: {
        enabled: false,
      },
      /** Registo apenas via `useRegisterSW` no React — evita script duplicado no index.html. */
      injectRegister: null,
      /** Utilizador confirma atualização (toast “Atualizar agora”) — evita ativar build nova em segundo plano sem controlo. */
      registerType: "prompt",
      includeAssets: ["escalax-icon.png", "favicon.ico"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        cleanupOutdatedCaches: true,
        /** Com `registerType: 'prompt'`, o skipWaiting é acionado ao chamar `updateServiceWorker(true)`. */
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: "EscalaX",
        short_name: "EscalaX",
        description: "EscalaX — Gestão operacional e de escala para tripulantes",
        start_url: "/",
        display: "standalone",
        background_color: "#F8FAFC",
        theme_color: "#2563EB",
        orientation: "portrait-primary",
        categories: ["productivity", "utilities"],
        icons: [
          { src: "/escalax-icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        file_handlers: [
          {
            action: "/",
            accept: {
              "application/pdf": [".pdf"],
            },
          },
        ],
        share_target: {
          action: "/share-import",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            files: [
              {
                name: "files",
                accept: ["application/pdf", ".pdf"],
              },
            ],
          },
        },
      },
    }),
  ].filter(Boolean),
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
