# Conexão com o portal de escala pelo próprio celular

Data: 2026-11-18 · Branch: `feat/escalax-v3`

## Por que mudar

O robô no servidor (Playwright + navegador remoto) teve 40 execuções sem sucesso. Os apps que funcionam (Crew Hub, CrewSync) fazem o oposto: o login acontece no celular da tripulante, numa tela de navegador dentro do app; a sessão fica guardada no aparelho; o app lê a escala de lá. O CrewSync descreve isso publicamente ("direto do iFlight Crew (SSO)", "credenciais ficam no iPhone, nunca nos nossos servidores", aviso de "sessão expirada" com botão para entrar de novo).

Este documento descreve esse caminho para a LATAM (iFlight). GOL e Azul usam a mesma peça depois, trocando só a configuração do portal.

## Como funciona para a tripulante

1. **Conectar (primeira vez):** em Fontes de escala, toca em "Conectar iFlight". Abre o iFlight (`getMainPage?companyId=LA`) numa tela do app. Ela faz o login normalmente (Google, Microsoft Authenticator). O app nunca vê nem guarda a senha.
2. **Leitura:** quando o iFlight carrega, o app tenta abrir sozinho Roster Calendar → Roster Report. Se não achar os botões em 20 s, mostra na própria página o passo a passo ("Menu ≡ → Roster → Roster Calendar → Roster Report"). Um selo no rodapé da página mostra o andamento: Conectando ao portal → Lendo sua escala → Salvando no aparelho.
3. **Salvar:** assim que o iFlight entrega o PDF da escala, o app captura os bytes, fecha a tela e importa com o leitor que já existe (`importPdfArrayBuffer`). A escala aparece como qualquer PDF importado.
4. **Aprender o caminho:** o app guarda, só no aparelho, qual requisição devolveu o PDF (método, endereço, corpo). 
5. **Sincronizar (vezes seguintes):** "Sincronizar escala" abre o iFlight escondido, com a sessão salva. Se cair na página de login, a sessão expirou: o card mostra "Reconectar". Se não, refaz a requisição aprendida dentro da página, recebe o PDF e importa, sem a tripulante ver nada. Se a requisição aprendida não devolver PDF, volta para o passo 1 (visível).
6. **Reset:** apaga a sessão do iFlight no aparelho e o caminho aprendido.

## Regras

- Só no app instalado (Android/iPhone). No navegador e no PWA continuam os caminhos atuais (PDF, extensão do Chrome).
- Sem trocar user-agent nem disfarçar o app. Se o portal bloquear o login na tela do app, o card mostra o erro e oferece importar o PDF.
- Nada sai do aparelho além do PDF importado (que já vai para a conta, como hoje). O caminho aprendido e a sessão ficam só no aparelho; o diagnóstico copiado não leva cookies, tokens nem valores sensíveis.
- O worker do servidor não é apagado nesta etapa; só deixa de ser o caminho do celular.

## Peças

| Peça | Arquivo | Responsabilidade |
|---|---|---|
| Configuração do portal | `src/modules/device-portal/providers.ts` | URL de entrada, hosts do portal e do login, textos dos botões de navegação, passo a passo |
| Script da página | `src/modules/device-portal/page-script.ts` | Roda dentro do iFlight: captura PDF + requisição de origem, selo de andamento, passo a passo, navegação automática, detecção de erro de login |
| Estado local | `src/modules/device-portal/session-store.ts` | Status (nunca conectado / sessão salva / expirada), última sincronização, caminho aprendido |
| Orquestração | `src/modules/device-portal/portal-session.ts` | `connect` (visível) e `sync` (escondido) em cima do `@capgo/inappbrowser`; importa o PDF |
| Card | `src/modules/device-portal/ui/DevicePortalCard.tsx` | "iFlight — LATAM": status, última sincronização, Sincronizar / Reconectar / Reset, passos |

## Fora desta etapa

- Ler tripulação, aeronave e "executada" separadamente (o PDF já traz o que o leitor atual entende).
- Sincronização em segundo plano sem abrir o app.
- GOL e Azul (mesma peça, configuração própria, depois que a LATAM estiver validada no celular).

## Risco conhecido

Nada disso foi validado num celular ainda. Se o Google recusar o login dentro do app, este caminho não serve como está. O próprio card mostra o erro ("disallowed_useragent", "app_not_configured_for_user" etc.) para sabermos na hora.

## Como verificar

- Testes de unidade: script da página (captura, selo, passo a passo, navegação, erro de login), estado local, orquestração com o plugin simulado (conectar, sincronizar com sessão salva, sessão expirada, caminho aprendido inválido).
- `npm test`, `tsc`, `eslint`, `npm run build` sem erros; APK novo gerado.
- No celular: conectar, ver a escala importada, fechar o app, abrir e tocar Sincronizar sem pedir login.
