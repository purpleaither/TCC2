# Componente de fisioterapia respiratória

O formulário do fisioterapeuta grava o domínio no plano e os parâmetros escolhidos para cada exercício. A tabela usada pela aplicação é `public.care_plans`. Planos anteriores e planos com domínio vazio continuam sendo tratados como musculoesqueléticos. Como o sistema exibe simultaneamente os planos vinculados ao paciente, a presença de planos musculoesqueléticos e respiratórios abre o diário misto.

A migração `database/2026-11-27_respiratorio.sql` pode ser reaplicada e deve ser executada no ambiente candidato antes da homologação com contas fictícias. Ela preserva as políticas RLS e permite que os campos de dor, rigidez e cansaço fiquem vazios no diário respiratório. Com o banco anterior, o fluxo musculoesquelético continua disponível e a prescrição respiratória fica desabilitada. Os sintomas respiratórios ficam no histórico do paciente e nos registros individuais do profissional.

Os parâmetros do catálogo são editáveis pelo fisioterapeuta e só são prescritos quando o plano é salvo. O aviso de falta de ar em repouso aparece na seleção de valores de 7 a 10 e é reapresentado após o envio. O aviso não modifica o plano. As rotas de clima e qualidade do ar consultam as mesmas coordenadas de referência de Brasília. As consultas começam em paralelo no envio respiratório ou misto. Se uma delas falhar, o diário é salvo com os dados disponíveis. O cartão após o envio e o histórico exibem os valores persistidos. A aplicação usa umidade abaixo de 30%, temperatura a partir de 28 °C e PM₂,₅ a partir de 25 µg/m³ como gatilhos de mensagens educativas. Esses limites são editoriais e não classificam risco individual nem autorizam mudanças na prescrição.

A tabela de acompanhamento usa o período selecionado e mostra o último registro por dia, incluindo dias com treino e sem diário. Um campo vazio indica ausência de registro disponível. A tabela não estima efeitos do clima sobre os sintomas.

## Verificação

Execute `node --test tests/respiratorio.test.cjs` para verificar a seleção de domínio e os dados enviados para os três perfis. Os testes simulam a persistência e as falhas independentes de clima e qualidade do ar. Execute também `node --test tests/auditoria/qualidade-ar.test.mjs` para validar a resposta da rota, os casos indisponíveis e o texto educativo.

O teste `node tests/auditoria/respiratorio-interface.cjs` usa o Playwright e o axe-core de `tests/auditoria` e um navegador Chromium. Ele serve os arquivos localmente e usa perfis fictícios para inspecionar as etapas do diário, o alerta acionado pelo teclado, os estados do cartão ambiental, a tabela longitudinal e os campos do catálogo.  Para a homologação, use contas fictícias para salvar e editar cada perfil, conferir os registros após recarregar e auditar as novas etapas com axe-core e Lighthouse, incluindo navegação por teclado e ampliação de texto. A nota de acessibilidade das novas telas depende desta auditoria.
