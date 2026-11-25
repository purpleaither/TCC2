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
