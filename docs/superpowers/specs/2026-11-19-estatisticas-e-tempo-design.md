# Estatísticas, MetCenter realocado e temperatura certa

Data: 2026-11-19 · Branch: `feat/escalax-v3`

## Objetivo

Antes de ir para produção, o app ganha uma tela de **Estatísticas** da escala (no lugar do MetCenter
na barra de baixo), o tempo passa a aparecer de forma discreta dentro de outras telas, e a
**temperatura mostrada precisa estar certa**.

Critério de pronto: com a escala real de novembro/2026 importada do iFlight, a tela mostra os números
abaixo e eles batem com a escala; a temperatura de cada pouso é a prevista para o horário do pouso.

## Etapas

1. **Hoje, com os dados que já temos:** tela Estatísticas (Mês / Ano / Sempre), MetCenter realocado,
   correção do tempo, tabela de aeroportos com fuso.
2. **Hoje, se houver o login dela no iFlight por 15–30 min:** matrícula do avião e tripulantes por voo
   (descobrir as chamadas no portal real, como foi feito com `loadRosterReport`).
3. **Depois:** aba Grupo (comparar com colegas).

## Estatísticas (etapa 1)

Rota `/estatisticas`, no lugar de MetCenter na barra de baixo. Abas **Mês**, **Ano**, **Sempre**;
setas para trocar o mês/ano. Seções, nesta ordem:

- **Resumo:** horas voadas (soma de `flight_hours`), jornada (soma de `duty_hours`), folgas (dias com
  `entry_type = day_off`), eficiência (voadas ÷ jornada), apresentações antes das 06h e pousos depois
  das 23h (horário local da estação).
- **Qualidade de vida:** noites em casa e fora (a noite conta como fora quando o último pouso do dia
  não é na base), pernoites e pernoites por cidade, fins de semana livres (sábado e domingo sem voo,
  reserva ou sobreaviso), maior bloco de folga, maior sequência de dias de trabalho. A base vem de
  `user_settings.base_airport`; sem ela, usa a estação onde mais jornadas começam, e mostra o convite
  "Em que cidade você mora?" com link para o perfil.
- **Voos:** pernas voadas (voos `OP`), deadheads (voos `PS`) e suas horas, distância em km e
  "voltas na Terra" (40.075 km), rota mais voada, dia com mais pernas; horas diurnas (06h–18h) e
  noturnas (18h–06h) no fuso da base; ritmo: dias com voo, etapas por dia, duração média, etapa mais
  longa e mais curta (pela `flight_hours`).
- **Aeroportos:** mapa de rotas offline, aeroportos diferentes (com selo "novo" para os que aparecem
  pela primeira vez no período em relação a todo o histórico), rotas mais voadas, pernoites por cidade.
- **Aeronaves:** tipo dominante e etapas por tipo (`aircraft_type`). Matrícula fica para a etapa 2.
- **Descobertas:** até 5 frases geradas a partir dos números acima (só quando o dado existe).

**Dados:** as estatísticas leem `schedule_entries` de **todas** as escalas importadas da usuária e,
para cada dia, ficam com as linhas da importação mais recente que cobre aquele dia. Assim "Ano" e
"Sempre" acumulam meses mesmo depois que uma nova importação desativa a anterior. A tela Escala
não muda nesta etapa.

**Cálculos:** módulo puro em `src/lib/stats/` (sem React, sem Supabase), com testes usando a escala
real de novembro como referência numérica. A tela só formata.

**Aeroportos:** tabela gerada a partir do OurAirports (domínio público) com IATA, ICAO, cidade,
coordenadas e fuso IANA, cobrindo Brasil e América do Sul e os destinos internacionais da LATAM.
O fuso brasileiro vem do estado (`iso_region`); os demais, de um mapa por país. Um script em
`scripts/` gera o arquivo; o arquivo gerado vai no repositório.

**Mapa:** contorno de países do Natural Earth 110m (`world-atlas`) com `d3-geo`, desenhado em SVG,
sem internet. Linhas retas entre aeroportos (não é a trajetória real), zoom e "enquadrar".

## MetCenter realocado

- Sai da barra de baixo. A página `/weather` continua existindo, sem item na barra.
- **Início:** uma faixa discreta com o tempo da base e do próximo destino, e um link "METAR/TAF" para
  a página completa.
- **Escala:** cada voo continua mostrando o tempo do pouso, agora certo (abaixo).

## Temperatura certa

Problemas encontrados em `useAirportWeather`:

1. Mostra a temperatura **atual** com o rótulo "Pouso às 20:00".
2. Vento do Open-Meteo vem em km/h e é exibido como "kt".
3. Códigos 80–82 (pancadas de chuva) aparecem como "Chuvisco leve"; outros códigos agrupados errado.
4. METAR não chega (categoria sempre "UNKN").
5. Só ~25 aeroportos conhecidos; os demais ficam sem tempo.

Correções:

- Voos futuros (até o limite da previsão, 16 dias): temperatura, condição e vento **previstos para a
  hora do pouso** (`hourly` do Open-Meteo, hora convertida para UTC pelo fuso do aeroporto). Fora da
  janela: não mostra número (nunca mostra a temperatura de hoje como se fosse a do pouso).
- Agora / base: temperatura atual do METAR quando disponível; senão, a atual do Open-Meteo, com o
  rótulo "agora".
- Vento pedido em nós (`wind_speed_unit=kn`).
- Tabela de códigos WMO corrigida (garoa, chuva, pancadas, trovoada etc.).
- METAR: diagnosticar por que não chega (CORS, formato ou ICAO) e corrigir; se o serviço não aceitar
  chamada direta do app, buscar por uma rota da Vercel em `api/`.
- Usar a tabela nova de aeroportos (todos os destinos têm coordenadas).

## Testes

- `src/lib/stats/*.test.ts` com a escala real de novembro (54 eventos, 40 voos) como fixture
  anonimizada: horas, pernoites, fins de semana, distância, diurnas/noturnas, rotas, aeroportos.
- Tempo: escolha da hora prevista (pouso futuro, fora da janela, agora), unidades e tabela WMO.
- Tela: renderiza as seções com dados de exemplo; barra de baixo sem MetCenter e com Estatísticas.
- Validação final no emulador com a conta real.

## Fora do escopo

Matrícula e tripulantes (etapa 2), aba Grupo (etapa 3), mudar a tela Escala para mostrar vários
meses, salário.
