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

A verificação autenticada executada no GitHub Actions com contas fictícias e Supabase real examinou 12 estados. Dez passaram e dois foram reprovados. No diário, `color-contrast` (WCAG 1.4.3, gravidade séria) atingiu quatro rótulos das escalas. No histórico, a mesma regra atingiu 24 elementos entre rótulos estatísticos e números de dias, e `label-content-name-mismatch` (WCAG 2.5.3, gravidade séria) atingiu três células interativas do calendário. A biblioteca foi avaliada na tela de seleção, antes da pesquisa. A branch local contém ajustes de contraste nos rótulos das escalas, nas estatísticas e nos dias do calendário. Também passou a incluir no nome acessível os valores visíveis das células interativas. A renderização isolada, com entradas fictícias em memória, apresentou zero violações nas duas telas e manteve a indicação de inspeção manual do contraste. Após a publicação, o reteste com sessões reais das contas fictícias examinou novamente os 12 estados e aprovou todos. Diário e histórico ficaram sem violações detectadas nessa rodada. As verificações assinaladas para inspeção humana permanecem abertas. [Reteste autenticado](https://github.com/purpleaither/TCC2/actions/runs/45589016938) · [Evidência preservada](../evidencias/auditoria-local/axe-autenticado-reteste.json). A evidência preserva regras e seletores sem conteúdo privado. [Execução](https://github.com/purpleaither/TCC2/actions/runs/45533847211) · [Resultados por tela](../evidencias/auditoria-local/axe-autenticado-inicial.json)

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

Uma coleta posterior fez somente requisições GET para os quatro recursos públicos correspondentes em produção. A resposta HTML não apresentou CSP nem X-Frame-Options, e as quatro respostas não apresentaram X-Content-Type-Options. HSTS estava presente. O cabeçalho Server observado foi `envoy`, de modo que a exposição da versão do Python não se reproduziu nesse ponto de observação. Na prévia, os quatro recursos direcionaram para a proteção de acesso da Vercel. Os cabeçalhos do redirecionamento descrevem a proteção de acesso. A coleta não avaliou impacto por exploração, cookies de sessão ou a resposta autenticada da prévia. [Cabeçalhos observados](../evidencias/auditoria-local/cabecalhos-vercel.json)

## Continuação na versão candidata

O workflow da candidata serviu os arquivos e os handlers do SHA exato da branch em loopback. O HTML, CSS e JavaScript retornados pelo servidor foram comparados byte a byte com o checkout. A autenticação e a persistência usaram o Supabase real com as contas fictícias. A prévia da Vercel exigiu autenticação, por isso a regressão não usou a URL pública de produção para carregar a interface. A primeira tentativa do novo workflow parou na instalação do Chromium para Ubuntu 26.04. A execução seguinte usou o Ubuntu 24.04 e concluiu a coleta. [Tentativa inicial do workflow](https://github.com/purpleaither/TCC2/actions/runs/45589477226) · [Primeira coleta da candidata](https://github.com/purpleaither/TCC2/actions/runs/45589810841/artifacts/15011375215)

Na primeira coleta da candidata, o axe-core voltou a aprovar os 12 estados. Os snapshots de acessibilidade do Lighthouse avaliaram os mesmos estados em mobile e desktop. Em cada configuração, quatro estados receberam 100 e oito receberam 98 por `heading-order`. As seções de nível diretamente subordinado ao título principal passaram a usar nível 2. Os níveis de subtítulos internos foram preservados. Os snapshots medem o estado da interface autenticada, enquanto os indicadores de carga do login permanecem na série descrita anteriormente.

O caso CT44 induziu duas falhas HTTP 502 na rota meteorológica. A interface informou a indisponibilidade, e o sintoma foi recuperado após recarregar a página, sem valores meteorológicos associados. O caso CT45 mostrou que, após uma falha simulada HTTP 503 na biblioteca, a interface apresentou o aviso e a opção de adicionar manualmente continuou disponível. Os testes de sessão confirmaram, nos dois perfis, o retorno ao login após recarregar e a remoção da chave de sessão do armazenamento local. [Evidências da primeira coleta](../evidencias/auditoria-local/candidata-45589810841/)

Na execução seguinte, o CT46 recebeu HTTP 503 do handler candidato. Em uma verificação auxiliar, o frontend candidato consultou a rota publicada do catálogo com a conta fictícia. O retorno HTTP 200 permitiu testar o termo existente e o termo inexistente, os filtros domiciliar e de ombros e a reprodução de um vídeo, cujo tempo avançou mais de 0,2 s. A lista exibiu 43 resultados sem filtros, 19 domiciliares e 15 na região de ombros. A comparação independente de equivalências de nomes ficou bloqueada porque o conjunto de referência não coincidiu com os itens retornados. O cenário CT22 continua vinculado ao handler candidato. [Artefato do catálogo e das operações](https://github.com/purpleaither/TCC2/actions/runs/45590010899/artifacts/15010099884)

### Tempos operacionais observados no checkout

Os tempos abaixo correspondem à interação até a condição verificada pelo Playwright, exceto a consulta meteorológica, medida até os cabeçalhos da resposta. Os tempos de login e navegação visível foram registrados nos modos axe-core, Lighthouse mobile e Lighthouse desktop. Os demais valores são observações de regressão e podem incluir recargas, esperas e integrações. Sem repetições equivalentes por operação, os valores são descritivos.

| Operação | Observação |
| --- | --- |
| Autenticação até o painel do paciente | 1.357 a 1.911 ms |
| Autenticação até o painel profissional | 1.445 a 1.917 ms |
| Abertura da tela de planos profissionais | 403 a 412 ms |
| Criação de plano manual e verificação | 983 ms |
| Edição de plano, recarga e verificação | 4.701 ms |
| Registro de sintomas com clima disponível | 227 ms na primeira coleta |
| Registro de sintomas após falha climática simulada | 1.172 ms |
| Consulta meteorológica externa com timeout | Duas respostas HTTP 504 de aproximadamente 8.001 ms |
| Consulta da biblioteca pela rota publicada | 1.904 ms |
| Conclusão de exercício | 998 ms |
| Recarga e consulta do histórico | 588 ms |

A primeira coleta aprovou o CT26 com recuperação de dados meteorológicos reais. Na coleta seguinte, as duas tentativas do handler meteorológico em loopback retornaram HTTP 504. O CT26 reprovou nessa rodada, e o CT25 confirmou a persistência dos sintomas. A ocorrência indica instabilidade na consulta externa no ambiente da execução. [Resultados e tempos por modo](../evidencias/auditoria-local/candidata-45590010899/)

### Reteste final da candidata

O SHA `01f1c61f73ba9903ad4033c47e4f7025172e165f` passou nos 12 estados autenticados com axe-core e obteve 100 em todos os 24 snapshots do Lighthouse, 12 mobile e 12 desktop. A regra `heading-order` deixou de apresentar falhas. O reteste também confirmou os casos de indisponibilidade simulada nas duas APIs, sessão encerrada após recarga e isolamento entre contas fictícias. [Execução final](https://github.com/purpleaither/TCC2/actions/runs/45590549862) · [Artefato final](https://github.com/purpleaither/TCC2/actions/runs/45590549862/artifacts/15011341541) · [Resumo preservado](../evidencias/auditoria-local/candidata-45590549862/resumo.json)

O clima real voltou a responder no reteste, com HTTP 200 em 209 ms até os cabeçalhos. O registro completo de sintomas levou 336 ms com clima disponível e 1.138 ms com falha simulada. A consulta auxiliar à biblioteca publicada levou 1.097 ms. A criação de plano manual e sua verificação levaram 975 ms. A edição com recarga levou 4.700 ms. Concluir o exercício levou 426 ms, e recarregar e consultar o histórico levou 512 ms. Esses valores descrevem a rodada final.

## Regressão e limitações

A regressão final executou a CI-01 a CI-07 no checkout candidato. Foram **34 verificações aprovadas e uma bloqueada**, excluída a preparação do cenário de treino. O caso bloqueado foi o CT22, registrado como falha no script devido à resposta HTTP 503 do catálogo no runner sem a chave ExerciseBank. As provas auxiliares de pesquisa, filtros e vídeo com a rota publicada não substituem o CT22. A comparação independente da nomenclatura também continua bloqueada pela ausência de itens de referência na amostra retornada.

Permanecem abertas as inspeções manuais, a confirmação dos cabeçalhos da prévia após autenticação e as medições repetidas de desempenho das operações que foram registradas apenas como observações funcionais. Os snapshots autenticados mediram acessibilidade por estado. Os indicadores de carga laboratoriais permanecem restritos ao login. A branch preservou a execução de referência e as rodadas intermediárias. [Checklist](PLANO_VERIFICACAO_TCC.md#inspeção-manual) · [Pull request](https://github.com/purpleaither/TCC2/pull/2)

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
