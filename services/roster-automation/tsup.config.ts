import { defineConfig } from 'tsup';

/**
 * Playwright (e chromium-bidi) não devem ser empacotados: usam imports dinâmicos e
 * caminhos internos que o esbuild não resolve de forma fiel. Em runtime o Node
 * carrega os pacotes reais de node_modules (igual em Linux/macOS/Windows).
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  bundle: true,
  sourcemap: true,
  splitting: false,
  dts: true,
  /** Não seguir estes pacotes no grafo de bundle (evita erros chromium-bidi/* no Windows). */
  external: [
    'playwright',
    'playwright-core',
    'chromium-bidi',
  ],
});
