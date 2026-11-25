# Plano de verificação complementar do MVP

A referência é a [execução 45530998960](https://github.com/purpleaither/TCC2/actions/runs/45530998960), vinculada ao commit `b12d9456a822683eec83768b52742b0c927ca164`. A branch parte de `58fe9f8`, que acrescentou o resumo dessa execução. A numeração complementar começa em CT33, após CT32.

| Bateria | Cobertura anterior | Lacuna e critério de aceitação |
| --- | --- | --- |
| CI-08, CT33 e CT42 | CI-01 verifica a renderização | axe-core por estado da interface. Aceitação quando nenhuma violação for detectada nas regras A e AA aplicáveis |
| CI-09, CT34 e CT42 | Sem Lighthouse | Cargas do login e snapshots dos estados autenticados em mobile e desktop, com resultados por regra. Meta operacional de acessibilidade 1,0 |
| CI-10, CT35 e CT36 | CI-01 verifica larguras selecionadas | Ordem direta e reversa no formulário, foco distinguível e ausência de rolagem horizontal nas larguras especificadas. Registrar capturas e separar inspeções manuais |
| CI-11, CT37 e tempos operacionais | Sem série de desempenho | Três cargas por perfil. Metas de laboratório do MVP de FCP ≤ 1.800 ms, LCP ≤ 2.500 ms, CLS ≤ 0,1 e TBT ≤ 200 ms, avaliadas pela mediana por perfil. Speed Index, requisições, transferência e duração são indicadores descritivos. Os tempos de operação são relatados por cenário e dependência |
| CI-12, CT39, CT45 e CT46 | CT22 cobre seleção e persistência da biblioteca | Catálogo real, pesquisa por termos existente e inexistente, filtros de região e domicílio, contraste dos nomes com um glossário de referência e avanço demonstrável do vídeo. Em falha simulada, verificar aviso e cadastro manual independente |
| CI-13, CT38, CT40, CT43 e CT44 | CT25 e CT26 cobrem sintomas e dados associados | Na rota intermediária, validar contrato e tratamento de falhas simuladas. Na interface, provocar duas tentativas HTTP 502, verificar aviso, e recuperar após recarregar o registro sem medições meteorológicas |
| CI-14 | CI-07 verifica isolamento funcional | Relatório passivo em ambiente isolado, com triagem por risco, confiança e aplicabilidade. Comparar com cabeçalhos públicos de produção e distinguir respostas de proteção da prévia |
| CI-15, CT41 | CT31 e CT32 cobrem isolamento de leitura e inserção entre pacientes | Complementar com revisão defensiva de políticas, sessão e tratamento de dados, e testes autorizados de comportamento com contas fictícias. Verificar encerramento após recarga e remoção da chave local da sessão |

O primeiro recorte local audita a tela de login servida a partir do checkout, com a API de configuração ausente e o botão de autenticação indisponível. O recorte mede a apresentação do formulário e os recursos da página nesse ambiente. Os relatórios desse recorte não representam estados autenticados ou latência de operação na Vercel. A auditoria CT42 abre os estados autenticados do checkout em loopback e usa a configuração pública da Vercel para autenticar nos serviços reais do Supabase com as duas contas fictícias. As telas são avaliadas sem salvar planos ou registros.

## Regressão da candidata

O workflow da candidata fixa o SHA do PR e verifica por comparação de bytes o HTML, CSS e JavaScript servidos em loopback. Executa os handlers do mesmo checkout. A configuração pública do Supabase vem da Vercel e as contas fictícias são fornecidas pelos secrets existentes. Bloqueios de dependências são registrados por cenário. Quando necessário, a verificação auxiliar do frontend com a rota publicada do catálogo é identificada à parte e não substitui o CT22 da regressão da candidata.

## Inspeção manual

- [ ] Verificar foco e navegação em menus, diálogos, seletores e escalas de sintomas, incluindo Enter, Espaço e Escape.
- [ ] Verificar redimensionamento de texto a 200% e reflow com zoom a 400%, considerando as exceções do critério 1.4.10.
- [ ] Verificar alvos interativos considerando tamanho, espaçamento e exceções do critério 2.5.8.
- [ ] Conferir organização, legibilidade, contraste de indicadores, mensagens e sobreposição de conteúdo nos fluxos autenticados.
- [ ] Conferir alternativas textuais, demonstrações em vídeo e interação com leitor de tela.

## Critérios da rodada de finalização

A série CI-11 repete três vezes os mesmos scripts em runner Ubuntu 24.04, com Chromium novo a cada script, rede padrão sem throttling e cache padrão durante cada operação. Somente uma amostra com a condição funcional esperada integra a série. Para registro com clima disponível, CT25 e CT26 devem passar. Para falha simulada, os dois casos CT44 devem passar. A mediana é comparada aos limites operacionais definidos antes da leitura dos resultados.

| Operação | Início e término | Limite da mediana |
| --- | --- | --- |
| Criação de plano manual | Início do cenário até a confirmação do plano e exercício no painel | 3.000 ms |
| Edição com recarga | Abertura do cenário de edição até a verificação do texto após recarregar | 6.000 ms |
| Registro de sintomas com clima real | Acionamento de concluir até a resposta de inserção | 3.000 ms |
| Registro durante falha simulada | Mesmo intervalo, com HTTP 502 induzido e validação da persistência | 3.500 ms |
| Conclusão de exercício | Acionamento até a confirmação no controle da sessão | 3.000 ms |
| Consulta ao histórico | Início da recarga até a exibição do exercício concluído no histórico | 3.000 ms |

CT46 compara os nomes efetivamente renderizados com o glossário cadastrado usando a amostra real, e registra identificador, nome original, equivalência e situação. Trata-se de consistência textual. A adequação da nomenclatura exige conferência especializada. CT47 verifica ativação por teclado e percurso entre os botões da escala. As dimensões registradas são evidência para inspeção da aplicação do critério 2.5.8.

### Registro de inspeção manual

| ID | WCAG 2.2 | Tela | Procedimento | Resultado esperado | Evidência | Observado | Situação |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IM01 | 2.1.1, 2.1.2, 2.4.3, 2.4.7, 2.4.11 | Menus, seletores, histórico e sintomas | Percorrer com Tab e Shift+Tab, ativar com Enter e Espaço, fechar componentes quando aplicável e verificar retorno do foco | Todos os controles operáveis, foco visível e ordem coerente | Vídeo do percurso e capturas do foco | A preencher | Pendente |
| IM02 | 1.4.4, 1.4.10 | Diário, formulários, biblioteca e histórico | Ampliar texto a 200% e usar zoom real a 400% no navegador, considerando as exceções | Conteúdo e ações acessíveis, sem sobreposição ou rolagem indevida | Capturas com valor do zoom e notas sobre exceções | A preencher | Pendente |
| IM03 | 2.5.8 | Escalas, menus e calendário | Medir controles contíguos e verificar tamanho, distância e exceções | Alvos de 24 × 24 pixels CSS ou cumprimento de exceção aplicável | Capturas comentadas e medições | A preencher | Pendente |
| IM04 | 1.4.3, 1.4.11, 3.3.1, 3.3.2 | Login, diário e planos | Inspecionar contraste de texto e indicadores, mensagens de erro e organização dos campos | Texto e estados distinguíveis, com instruções compreensíveis | Capturas e razões de contraste | A preencher | Pendente |
| IM05 | 1.1.1, 1.3.1, 2.4.6, 4.1.2, 4.1.3 | Login e áreas autenticadas | Navegar com leitor de tela e conferir títulos, rótulos, nomes, estados e anúncios | Semântica e alterações de estado comunicadas de forma inteligível | Versão da tecnologia assistiva e registro do percurso | A preencher | Pendente |
| IM06 | 1.2.1 a 1.2.5, conforme aplicabilidade | Biblioteca e demonstrações | Identificar se há áudio e informação visual essencial, e verificar alternativas aplicáveis | Conteúdo demonstrativo com alternativa adequada à modalidade | Ficha da mídia e evidência das alternativas | A preencher | Pendente |

## Requisitos de personalização e linguagem simples

| ID | Tipo | Requisito e evidência esperada | Casos |
| --- | --- | --- | --- |
| RF-A01 | Funcional | Painel disponível no login e para ambos os perfis, com identificação textual e controles nativos | CT48, CT49, CT53 |
| RF-A02 | Funcional | Manter tema, escala, contraste, espaçamento e movimento no navegador, inclusive após sair. Restaurar valores padrão | CT50, CT51, CT52 |
| RF-A03 | Funcional | Explicações acionáveis por toque para termos do diário, dos exercícios e do clima | CT53, IM05 |
| RNF-A01 | Não funcional | Preservar acesso e foco com teclado e tamanho de texto ampliado em tela pequena. Sem bloquear zoom real | CT35, CT47, CT48, CT50, IM01, IM02 |
| RNF-A02 | Não funcional | Verificar nomes, papéis e contraste nos temas e no alto contraste. Validar a apresentação da informação sem depender de cor | CT42, CT49, IM03, IM04 |
| RNF-A03 | Não funcional | Usar preferências do sistema para aparência e movimento, mantendo a reprodução da mídia demonstrativa | CT51, CT46, IM06 |

A auditoria textual examinou as páginas ativas do login, do paciente e do profissional e as mensagens de transição. Rigidez, fadiga, séries, repetições, plano terapêutico, umidade relativa, pressão atmosférica e hPa recebem explicações por controles nativos. O diário descreve a escala de 0 a 10. As siglas MVP e END e o termo cinesioterapia não foram localizados como rótulos da interface ativa. O nome do fornecedor é preservado. Mensagens de acesso usam os termos e-mail, senha e serviço. A revisão terminológica dos nomes de exercícios permanece separada das orientações clínicas e prescrições.
