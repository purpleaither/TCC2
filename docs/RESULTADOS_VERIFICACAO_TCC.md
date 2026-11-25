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

## Rodada de finalização

A execução de referência foi conferida no artefato `15011341541`: 12 estados autenticados passaram no axe-core, 24 snapshots tiveram pontuação 100 e a regressão funcional registrou 34 aprovações e um bloqueio. O código do handler confirma que a ausência das variáveis `EXERCISEBANK_API_KEY` e `EB_KEY` produz HTTP 503 antes de consultar o fornecedor. A candidata local reproduziu o HTTP 503 sem essas variáveis. No GitHub Actions, o workflow verifica a disponibilidade dos dois nomes aceitos pelo handler, sem imprimir valores. A produção foi usada exclusivamente como evidência auxiliar da interface; a proteção de acesso da prévia impede sua adoção como destino autenticado sem uma autorização para esse ambiente.

O commit `c71227d` incluiu uma CSP aplicada para restringir enquadramento, objetos e URL-base, além de X-Frame-Options DENY e X-Content-Type-Options nosniff. A lista mais específica de domínios e diretivas foi colocada em modo de relatório. O arquivo Vercel foi aplicado também no servidor candidato de testes. O GET local retornou os quatro cabeçalhos configurados, e o teste de interface local aprovou CT33, CT35 e as seis larguras CT36. A coleta de navegador registra somente diretiva, origem e regime de aplicação. O modo de relatório permite observar a mídia assinada antes de escolher uma lista definitiva de origens. [Evidências locais](../evidencias/finalizacao-c71227d/) · [Execução da candidata](https://github.com/purpleaither/TCC2/actions/runs/45594510366)

### Painel de acessibilidade, aparência e linguagem

O commit `9e40083` acrescentou controles nativos de aparência e leitura em todas as telas, persistidos no navegador. O login passou em nove verificações locais do painel. O axe-core não registrou violações nas três configurações verificadas com o painel aberto, claro, escuro e alto contraste. Com espaçamento ampliado e movimento reduzido, a fonte raiz mediu 16, 20, 24 e 32 pixels nas escalas 100%, 125%, 150% e 200%, sem rolagem horizontal no recorte de 320 pixels CSS. A restauração voltou ao tema do sistema, ao tamanho padrão e às opções adicionais desativadas. CT33, CT35 e as seis larguras CT36 também passaram. O teste de 320 pixels CSS é evidência de reflow nesse recorte e não representa a inspeção de zoom real no navegador. [Evidências do painel](../evidencias/preferencias-9e40083/)

O Lighthouse 13.6.0 obteve 100 nos snapshots locais do login com o painel aberto, tanto no tema claro quanto no escuro. Uma inspeção isolada da renderização escura dos 12 estados internos não encontrou violações nas regras automatizadas selecionadas. Essa inspeção local utilizou a estrutura estática das telas, sem autenticação, e complementa a rodada autenticada do workflow.

A auditoria complementar do PR com o painel implementado aprovou os 12 estados autenticados com axe-core. A série Lighthouse do login teve mediana arredondada de FCP de 1.053 ms e LCP de 1.953 ms em mobile. Em desktop, as medianas foram de 282 ms e 503 ms. O TBT e o CLS medianos foram zero nos dois perfis. Essa execução usou o commit de integração do PR, registrado no artefato, enquanto o workflow da candidata verifica o SHA da branch. [Execução complementar](https://github.com/purpleaither/TCC2/actions/runs/45595424818) · [Relatórios e capturas](https://github.com/purpleaither/TCC2/actions/runs/45595424818/artifacts/15013525577)

### Rodada autenticada com o painel

Na execução `45596303799` (commit `3ce36c3`), o tema claro passou nos 12 estados no axe-core e marcou 100 nos 24 snapshots autenticados. No tema escuro, 11 estados passaram e o calendário do histórico com dados apresentou uma ocorrência da regra de contraste que afetou seis elementos. Os dois snapshots do histórico escuro receberam 96. Os outros 22 snapshots escuros receberam 100. As verificações de teclado na escala (CT47), ajuda móvel com texto ampliado (CT53) e persistência após sair (CT52, nos dois perfis) passaram. Os alvos medidos na escala tinham 44 × 32 pixels CSS. A cobertura desses alvos não representa uma inspeção de todas as exceções do critério 2.5.8.

O CT22 continuou bloqueado por HTTP 503 no checkout sem a credencial. O cenário auxiliar usou o frontend candidato, com retorno HTTP 200 da rota publicada. A amostra real tinha 50 itens. A conferência textual verificou os 43 nomes exibidos contra o glossário e registrou sete itens sem equivalência cadastrada. Pesquisa, filtros e reprodução do vídeo selecionado passaram. A equivalência terminológica especializada e a inclusão persistente de um exercício real no plano da candidata continuam pendentes. [Artefato da rodada](https://github.com/purpleaither/TCC2/actions/runs/45596303799/artifacts/15013901788) · [Amostra e resultados](../evidencias/finalizacao-45596303799/)

#### Repetições de desempenho

A série registrou três medições válidas por operação, no Chromium 145.0.7632.6, sem throttling, com cache padrão em uma instância nova do navegador a cada script. Os valores são tempos operacionais do Playwright, em milissegundos.

| Operação | Valores | Mínimo | Mediana | Máximo | Limite | Resultado |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Criação de plano | 1.455, 1.450, 954 | 954 | 1.450 | 1.455 | 3.000 | Aprovado |
| Edição com recarga | 5.684, 5.683, 5.205 | 5.205 | 5.683 | 5.684 | 6.000 | Aprovado |
| Sintomas com clima | 448, 245, 220 | 220 | 245 | 448 | 3.000 | Aprovado |
| Sintomas com falha | 1.166, 1.347, 1.374 | 1.166 | 1.347 | 1.374 | 3.500 | Aprovado |
| Conclusão de exercício | 1.457, 997, 1.197 | 997 | 1.197 | 1.457 | 3.000 | Aprovado |
| Consulta ao histórico | 1.279, 673, 1.324 | 673 | 1.279 | 1.324 | 3.000 | Aprovado |

O cenário de edição e recarga inclui navegação, espera de seleção, confirmação da alteração e verificação após recarregar. A mediana ficou abaixo da meta operacional, com margem de 317 ms. Os resultados não justificam alteração do código de edição. Autenticação, painéis, catálogo e requisição meteorológica têm observações individuais anteriores, sem uma série equivalente nesta rodada. [Dados da série e horário de cada amostra](../evidencias/finalizacao-45596303799/desempenho-operacoes.json)

A correção do calendário identifica a intensidade por atributo de dados da célula e associa, no CSS, cores de texto escuras aos fundos quentes do calendário. A representação numérica permanece disponível. Um reteste local com quatro intensidades fictícias e marca de treino apresentou zero violações detectadas no claro, no escuro e em alto contraste. A execução autenticada seguinte verifica o mesmo fluxo com a candidata. [Reteste local](../evidencias/finalizacao-0678598/calendario-local.json) · [Execução autenticada](https://github.com/purpleaither/TCC2/actions/runs/45597393346)

O navegador não registrou eventos de violação da CSP no ensaio de autenticação, navegação e reprodução auxiliar do catálogo no commit `3ce36c3`. Os cabeçalhos públicos da Vercel mostraram resposta HTTP 200 em produção e redirecionamento HTTP 302 na prévia protegida. A primeira repetição passiva na candidata instalada no GitHub Actions expirou antes de gerar relatório, com erros de criação e bloqueio das preferências Java. A repetição local encontrou falta de espaço no armazenamento do Docker durante a instalação da imagem. A execução passiva de recuperação usa um diretório gravável para as preferências Java e permanece restrita a requisições GET em loopback. [Inspeção pública](../evidencias/finalizacao-45596303799/cabecalhos-vercel.json)

#### Reteste autenticado após a correção do calendário

No SHA `0678598`, o axe-core aprovou 12 de 12 estados tanto no tema claro quanto no escuro. O Lighthouse atribuiu 100 aos 48 snapshots, com 12 telas em cada combinação de tema e perfil de dispositivo. A violação de contraste do histórico escuro deixou de ser detectada. A regressão CI-01 a CI-07 aprovou **36 verificações**, incluindo as duas verificações novas de persistência após sair, e manteve **CT22 bloqueado**. A consulta real ao clima e a persistência durante a falha simulada passaram. O vídeo, os filtros e a consistência do glossário passaram no ensaio auxiliar com a rota publicada. [Execução](https://github.com/purpleaither/TCC2/actions/runs/45597393346) · [Artefato](https://github.com/purpleaither/TCC2/actions/runs/45597393346/artifacts/15013903392) · [Classificação da regressão](../evidencias/finalizacao-0678598/regressao-casos.json)

A repetição no SHA `0678598` aprovou as seis metas operacionais. As medianas foram de 988 ms para criar plano, 4.723 ms para editar com recarga, 241 ms para registrar sintomas com clima, 1.103 ms durante falha meteorológica simulada, 429 ms para concluir exercício e 436 ms para consultar o histórico. A variação entre as duas séries de runners não permite atribuir causalidade à correção do contraste. [Valores individuais, navegador, limites e horários](../evidencias/finalizacao-0678598/desempenho-operacoes.json)

#### Reteste passivo da configuração de cabeçalhos

O ZAP 2.17.0 concluiu a auditoria isolada após a correção do diretório de preferências Java. O reteste executou quatro GET em loopback sobre a mesma versão dos arquivos e cabeçalhos da candidata, em commit com ajuste exclusivo do workflow. Os alertas de CSP ausente, proteção contra enquadramento ausente e X-Content-Type-Options ausente deixaram de aparecer. A versão do servidor Python anteriormente identificada não se aplicou ao servidor desta rodada.

O ZAP registrou quatro alertas médios de política incompleta, diretiva com curinga, scripts inline e estilos inline, além de dois informativos, presença de política em modo de relatório e classificação como aplicação web moderna. O uso de modo de relatório e a compatibilidade com os controles inline existentes explicam o estágio atual da política. Esses achados não demonstram exploração nem descaracterizam a proteção de enquadramento aplicada. A verificação da prévia autenticada e o endurecimento adicional após validação em implantação permanecem pendentes. [Execução passiva](https://github.com/purpleaither/TCC2/actions/runs/45598638375) · [Relatórios HTML e JSON](https://github.com/purpleaither/TCC2/actions/runs/45598638375/artifacts/15013588229) · [Resumo](../evidencias/finalizacao-0678598/zap-resumo.json)

## Refatoração modular e segurança

A refatoração foi desenvolvida em branch dedicada. Foram separados os componentes de calendário, biblioteca, vídeos, planos e acompanhamento, os serviços de autenticação e dados, as ações de interface e as folhas de estilo. A ordem da cascata CSS foi preservada. O HTML de entrada permaneceu em um único arquivo para manter o carregamento estático e a estrutura inicial da aplicação.

| Verificação desta rodada | Resultado observado |
| --- | --- |
| Testes locais de rotas e privacidade | 18 aprovados. Incluem cenários simulados das APIs e a varredura por chaves privilegiadas nos módulos do frontend. |
| Interface pública | 8 casos aprovados, incluindo axe-core no login e reflow nas seis larguras da matriz. |
| Preferências de acessibilidade | 9 casos aprovados. O axe-core 4.14.1 retornou zero violações no painel claro, escuro e de alto contraste. |
| Comparação de interface autenticada | Chromium local em 390 × 844, nos temas claro e escuro, com respostas fictícias. Foram comparadas 32 capturas, incluindo capturas de login repetidas por perfil. 29 foram idênticas e três apresentaram pequenas diferenças de rasterização nas bordas do login. A navegação do histórico por teclado e a abertura do editor foram verificadas. |
| Persistência transacional | A função foi testada com PostgreSQL local. A edição com item inválido preservou o título e os itens existentes. O acesso de leitura do paciente foi preservado, e a gravação por paciente, profissional sem vínculo ou sessão anônima foi recusada. |

O novo cabeçalho de política de referência está configurado no repositório. A implantação da migração e a regressão com o Supabase e a ExerciseBank no ambiente publicado dependem de uma rodada na candidata. A modalidade de gravação anterior permanece disponível em ambientes sem a função SQL. A ExerciseBank ainda recebe o identificador pseudonimizado necessário ao fluxo atual, e a política CSP ampliada permanece em modo de observação. As inspeções manuais anteriores continuam pendentes.

### Contagem de código

A contagem inclui as linhas físicas dos arquivos rastreados com extensão JavaScript, HTML, CSS ou SQL, excluindo a pasta de testes. São contabilizadas linhas em branco e comentários. Documentos, relatórios e imagens ficam fora desse total.

| Referência | Linhas | Diferença para a candidata |
| --- | ---: | ---: |
| `main` local de referência (`a903929`) | 5.162 | −518 |
| Início desta refatoração, após a limpeza anterior (`63f7c45`) | 4.283 | +361 |
| Candidata após o corte de duplicações (`fe0c6de`) | 4.644 | 0 |

No último corte foram excluídas 62 linhas e inseridas 57, com saldo de −5. Foram removidos campos sem consumidores e unificada a atualização visual das duas escalas de dor. O calendário passou a agrupar sintomas e treinos por data uma só vez. O servidor local da candidata também retornou a política de referência esperada e serviu JavaScript e CSS idênticos ao checkout.

Após o último corte, o reteste com Chromium 156.0.8078.79 manteve os 18 testes locais, os 8 casos de interface pública e os 9 casos de preferências aprovados. A nova comparação visual teve 30 de 32 capturas idênticas. As duas restantes apresentaram diferenças de 12 e 13 pixels nas bordas da tela de login, com diferença máxima de 2 por canal RGB. O histórico por teclado, a atualização das duas escalas de dor e a abertura do plano no editor foram verificados no mesmo ensaio com dados fictícios.

### Redução adicional no commit `692dcee`

O código da aplicação passou de 4.644 para 4.604 linhas. O diff do código excluiu 56 linhas e inseriu 16. A unificação da paleta escura economizou 25 linhas, a remoção de comentários redundantes economizou 13 e a simplificação da retentativa do clima economizou 2. A suíte de preferências ganhou duas linhas líquidas para verificar a troca de tema do sistema nos dois sentidos.

Foram repetidos os 18 testes de rotas e privacidade, os 8 casos de interface pública e os 9 casos de preferências. Todos passaram. O teste isolado do clima confirmou recuperação na segunda tentativa e encerramento após duas falhas. Das 32 capturas comparadas em Chromium com dados fictícios, 31 foram idênticas. Uma captura de login apresentou diferenças em 12 pixels de borda, com variação máxima de 2 por canal RGB. Os resultados de integração real continuam pendentes nesta candidata.
