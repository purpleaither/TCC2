# Plano de verificação complementar do MVP

A referência é a [execução 45530998960](https://github.com/purpleaither/TCC2/actions/runs/45530998960), vinculada ao commit `b12d9456a822683eec83768b52742b0c927ca164`. A branch parte de `58fe9f8`, que acrescentou o resumo dessa execução. A numeração complementar começa em CT33, após CT32.

| Bateria | Cobertura anterior | Lacuna e critério de aceitação |
| --- | --- | --- |
| CI-08, CT33 | CI-01 verifica a renderização | axe-core por estado da interface. Aceitação quando nenhuma violação for detectada nas regras A e AA aplicáveis |
| CI-09, CT34 | Sem Lighthouse | Relatórios mobile e desktop com estados e resultados por regra. Meta operacional de acessibilidade 1,0 |
| CI-10, CT35 e CT36 | CI-01 verifica larguras selecionadas | Ordem direta e reversa no formulário, foco distinguível e ausência de rolagem horizontal nas larguras especificadas. Registrar capturas e separar inspeções manuais |
| CI-11, CT37 | Sem série de desempenho | Três cargas por perfil. Metas de laboratório do MVP de FCP ≤ 1.800 ms, LCP ≤ 2.500 ms, CLS ≤ 0,1 e TBT ≤ 200 ms, avaliadas pela mediana por perfil. Speed Index, requisições, transferência e duração são indicadores descritivos |
| CI-12 | CT22 cobre seleção e persistência da biblioteca | Pesquisa, filtros, nomenclatura, vídeo e cenários degradados |
| CI-13, CT38 | CT25 e CT26 cobrem sintomas e dados associados | Na rota intermediária, validar contrato e tratamento de falhas simuladas. Na interface, ainda verificar continuidade e indicação de indisponibilidade |
| CI-14 | CI-07 verifica isolamento funcional | Relatório passivo em ambiente isolado, com triagem por risco, confiança e aplicabilidade |
| CI-15 | CT31 e CT32 cobrem isolamento de leitura e inserção entre pacientes | Complementar com revisão defensiva de políticas, sessão e tratamento de dados, e testes autorizados de comportamento com contas fictícias |

O primeiro recorte local audita a tela de login servida a partir do checkout, com a API de configuração ausente e o botão de autenticação indisponível. O recorte mede a apresentação do formulário e os recursos da página nesse ambiente. Os relatórios desse recorte não representam estados autenticados ou latência de operação na Vercel.

## Inspeção manual

- [ ] Verificar foco e navegação em menus, diálogos, seletores e escalas de sintomas, incluindo Enter, Espaço e Escape.
- [ ] Verificar redimensionamento de texto a 200% e reflow com zoom a 400%, considerando as exceções do critério 1.4.10.
- [ ] Verificar alvos interativos considerando tamanho, espaçamento e exceções do critério 2.5.8.
- [ ] Conferir organização, legibilidade, contraste de indicadores, mensagens e sobreposição de conteúdo nos fluxos autenticados.
- [ ] Conferir alternativas textuais, demonstrações em vídeo e interação com leitor de tela.
