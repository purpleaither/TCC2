# Resultados da verificação técnica e funcional do MVP

A publicação do projeto e de suas evidências no GitHub é de responsabilidade da autora do TCC, titular da conta `purpleaither`. O GitHub Actions executa as verificações e armazena os artefatos de execução.

## Método e escopo

A execução consolidada de referência foi concluída com êxito em 25 de novembro de 2026, no commit `b12d9456a822683eec83768b52742b0c927ca164`. A contagem histórica de 31 verificações reúne dois cenários de disponibilidade, 17 verificações de autenticação e 12 casos registrados pelas demais baterias, excluída a etapa de preparação do plano. O resumo anterior foi preservado. [Execução de referência](https://github.com/purpleaither/TCC2/actions/runs/45530998960) · [Evidência histórica](../evidencias/execucao-45530998960-1.json)

As auditorias locais compararam a versão inicial da `main` com dois retestes no checkout servido em loopback. A configuração da API de autenticação estava indisponível nesse servidor estático durante essas medições. A versão do frontend do segundo reteste corresponde ao commit `3875507`. As medições foram feitas em Linux, com Node.js 24.22.3, Chromium 156.0.8078.79, Playwright 1.58.2, axe-core 4.14.1 e Lighthouse 13.6.0. O plano registra a matriz de rastreabilidade, os critérios de aceitação e a lista de inspeção manual. [Plano complementar](PLANO_VERIFICACAO_TCC.md)

## Acessibilidade e interface

| Verificação local | Inicial | Primeiro reteste | Segundo reteste |
| --- | ---: | ---: | ---: |
| CT33, regras WCAG do axe-core com violações | 1 | 0 | 0 |
| CT35, ordem direta e reversa do foco no formulário | Reprovada | Aprovada | Aprovada |
| CT36, larguras sem rolagem horizontal | 6 de 6 | 6 de 6 | 6 de 6 |
| CT34, Lighthouse mobile e desktop | 94 em 6 cargas | 98 em 6 cargas | 100 em 6 cargas |

Na tela de login, sem autenticação, a regra `color-contrast` do axe-core identificou em `#loginStatus` uma razão de contraste de 3,54:1 para texto normal. A regra tem gravidade séria e corresponde ao critério 1.4.3 da WCAG. A cor foi alterada de `#888` para `#666` e a violação deixou de ser detectada. O primeiro Tab inicialmente alcançava `.menu-logout-btn` mesmo com o menu fora da tela. O menu fechado passou a usar `visibility: hidden`. O reteste confirmou a sequência e-mail, senha e retorno ao e-mail por Shift+Tab, com alteração visual de foco. [axe-core inicial](../evidencias/auditoria-local/axe-inicial.json) · [axe-core final](../evidencias/auditoria-local/axe-reteste-2.json) · [Teclado e larguras](../evidencias/auditoria-local/interface-reteste-2.json)

O Lighthouse também registrou `landmark-one-main` para o documento. A inclusão de `<main>` em torno das telas resolveu o alerta no segundo reteste. Os seis relatórios de cada rodada foram gerados em HTML e JSON e os resumos discriminam auditorias, pontuação e modo de apresentação, incluindo inspeção manual e não aplicabilidade. A pontuação descreve apenas as verificações automatizadas efetuadas na tela e não estabelece conformidade integral com a WCAG. [Lighthouse inicial](../evidencias/auditoria-local/lighthouse-inicial.json) · [Primeiro reteste](../evidencias/auditoria-local/lighthouse-reteste-1.json) · [Segundo reteste](../evidencias/auditoria-local/lighthouse-reteste-2.json)

A verificação autenticada executada no GitHub Actions com contas fictícias e Supabase real examinou 12 estados. Dez passaram e dois foram reprovados. No diário, `color-contrast` (WCAG 1.4.3, gravidade séria) atingiu quatro rótulos das escalas. No histórico, a mesma regra atingiu 24 elementos entre rótulos estatísticos e números de dias, e `label-content-name-mismatch` (WCAG 2.5.3, gravidade séria) atingiu três células interativas do calendário. A biblioteca foi avaliada na tela de seleção, antes da pesquisa. A branch local contém ajustes de contraste nos rótulos das escalas, nas estatísticas e nos dias do calendário. Também passou a incluir no nome acessível os valores visíveis das células interativas. A renderização isolada, com entradas fictícias em memória, apresentou zero violações nas duas telas e manteve a indicação de inspeção manual do contraste. O reteste com sessão real fica pendente após a publicação pela autora. A evidência preserva regras e seletores sem conteúdo privado. [Execução](https://github.com/purpleaither/TCC2/actions/runs/45533847211) · [Resultados por tela](../evidencias/auditoria-local/axe-autenticado-inicial.json)

## Desempenho laboratorial

Foram realizadas três cargas por perfil em cada rodada por meio do Lighthouse, que usa o Chrome DevTools Protocol. A simulação mobile empregou viewport de 412 × 823, RTT de 150 ms, taxa de 1.638,4 kbps e CPU 4× mais lenta. A configuração desktop empregou viewport de 1.350 × 940, RTT de 40 ms, taxa de 10.240 kbps e CPU sem desaceleração. As condições e os valores individuais, mínimo e máximo constam dos resumos das três rodadas.

| Indicador | Mobile inicial | Mobile final | Desktop inicial | Desktop final |
| --- | ---: | ---: | ---: | ---: |
| FCP, ms | 904 | 903 | 242 | 246 |
| LCP, ms | 2.014 | 1.987 | 479 | 489 |
| Speed Index, ms | 904 | 903 | 242 | 246 |
| TBT, ms | 0 | 0 | 0 | 0 |
| CLS | 0,00102 | 0,00102 | 0,00017 | 0,00017 |
| Recursos, bytes | 141.211 | 141.275 | 141.211 | 141.275 |
| Requisições | 12 | 12 | 12 | 12 |
| Evento de carga observado, ms | 110 | 97 | 124 | 125 |

Os valores são medianas das cargas de laboratório e ambos os perfis atenderam às metas CT37. O TBT mede o bloqueio da thread principal durante a carga laboratorial. A série não mediu INP, experiência de usuários reais nem latência das operações autenticadas. A variação observada entre as séries não permite atribuir ganho de desempenho às correções de acessibilidade.

## Integrações e persistência

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| CT39, falhas simuladas da ExerciseBank no servidor | 8 de 9 inicialmente e 9 de 9 no reteste. JSON inválido era convertido em uma lista vazia com HTTP 200. A rota passou a retornar HTTP 502 para catálogo inválido e mantém HTTP 200 para lista vazia válida | [Inicial](../evidencias/auditoria-local/exercisebank-inicial.tap) · [Reteste](../evidencias/auditoria-local/exercisebank-reteste.tap) |
| CT38, falhas simuladas do Open-Meteo no servidor | 8 de 8. Conexão, timeout, HTTP 429/500/502/504, JSON inválido e parâmetros ausentes foram tratados sem valores meteorológicos fabricados | [Resultados](../evidencias/auditoria-local/clima.tap) |
| CT40, Open-Meteo real via handler local | Bloqueado. A tentativa inicial retornou HTTP 502; a repetição com proxy retornou HTTP 502 com status externo 503 | [Tentativa inicial](../evidencias/auditoria-local/clima-real.json) · [Repetição](../evidencias/auditoria-local/clima-real-proxy.json) |
| CT43, consulta real na rota publicada na Vercel | HTTP 200. Brasília, 21,5 °C, umidade relativa 93%, pressão de superfície 892,3 hPa e horário de observação 02:30 UTC de 25 de novembro de 2026 | [Resposta verificada](../evidencias/auditoria-local/clima-vercel.json) |

As simulações não demonstram reprodução audiovisual, persistência após falhas ou continuidade do diário na interface. O teste real CT40 não mede o intermediário publicado na Vercel. A referência histórica contém evidência de seleção e persistência da biblioteca e de associação de dados meteorológicos aos sintomas.

## Segurança e privacidade

A inspeção CT41 passou nos arquivos HTML e JavaScript da raiz, procurando chaves Supabase privilegiadas identificáveis por prefixo ou por papel em JWT. A revisão estática identificou RLS declarada no esquema, restrições de leitura por vínculo e regras de alteração de planos condicionadas ao perfil profissional e ao vínculo. A versão auditada do frontend mantém sessão persistente via cliente Supabase. A rota meteorológica usa coordenadas fixas de Brasília e não encaminha dados do diário. A rota ExerciseBank usa um identificador derivado do usuário para emissão de URLs temporárias. Esses achados dizem respeito ao código inspecionado e não verificam o estado efetivo das políticas remotas nem certificam conformidade com a LGPD. [Teste estático](../evidencias/auditoria-local/privacidade.tap) · [Esquema](../database/schema.sql)

O ZAP 2.17.0 concluiu a coleta passiva no GitHub Actions e gerou relatórios HTML e JSON. A primeira tentativa local ficou bloqueada por falta de espaço no Docker. As primeiras execuções hospedadas falharam ao criar o diretório de configuração do ZAP. A configuração explícita do diretório permitiu concluir o reteste. A coleta examinou quatro recursos conhecidos do servidor estático. [Execução](https://github.com/purpleaither/TCC2/actions/runs/45534080183) · [Artefato](https://github.com/purpleaither/TCC2/actions/runs/45534080183/artifacts/14985754976)

| Alerta | Risco e confiança | Ocorrências | Triagem |
| --- | --- | ---: | --- |
| CSP ausente | Médio, alta | 1 | Ausência observada localmente. Verificar aplicabilidade à Vercel |
| Proteção contra enquadramento ausente | Médio, média | 1 | Ausência observada localmente. Verificar aplicabilidade à Vercel |
| Versão do servidor exposta | Baixo, alta | 4 | O cabeçalho identifica o servidor estático Python usado pelo teste |
| X-Content-Type-Options ausente | Baixo, média | 4 | Ausência observada localmente. Verificar aplicabilidade à Vercel |
| Aplicação web moderna | Informativo, média | 1 | Evidência de link com JavaScript |

O servidor estático difere da infraestrutura que entrega a aplicação publicada. A triagem não confirmou vulnerabilidades na Vercel, nem motivou alteração de CSP, cookies ou outras políticas na aplicação candidata. A avaliação passiva não exercitou a autenticação. [Resumo da triagem](../evidencias/auditoria-local/zap-resumo.json) · [Plano ZAP](../tests/auditoria/zap.yml)

## Regressão e limitações

CI-01 foi repetida no checkout local e aprovou os cenários desktop e mobile. A execução consolidada CI-01 a CI-07 permanece pendente na versão candidata. Parte dos scripts usa a URL de produção fixada no código e o workflow original grava resumos na `main`. A execução histórica permanece como referência anterior à branch. Seguem pendentes também Lighthouse autenticado, tempos das operações essenciais, reprodução dos vídeos, edição de plano sob auditoria, persistência em falha, verificações comportamentais adicionais de autorização e as inspeções manuais do plano. [Regressão CI-01](../evidencias/auditoria-local/regressao-ci01.json) · [Checklist](PLANO_VERIFICACAO_TCC.md#inspeção-manual) · [Pull request](https://github.com/purpleaither/TCC2/pull/2)

## Referências técnicas

- [W3C. WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Deque. Integração axe-core e Playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright)
- [Google. Auditorias do Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/)
- [Google. Pontuação de desempenho do Lighthouse](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [Google. Métricas de laboratório e de campo](https://web.dev/articles/lab-and-field-data-differences)
- [Microsoft. Playwright](https://playwright.dev/docs/intro)
- [OWASP ZAP. Automation Framework](https://www.zaproxy.org/docs/automate/automation-framework/)
- [Supabase. Controle de acesso com RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Open-Meteo. Weather Forecast API](https://open-meteo.com/en/docs)
