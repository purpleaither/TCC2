# Testes automatizados do MVP

Os testes verificam o funcionamento da aplicação publicada na Vercel usando Playwright e Chromium. São testes técnicos com contas fictícias, não testes com participantes nem validação clínica.

| Bateria | Script | Escopo |
| --- | --- | --- |
| CI-01 | playwright-smoke.cjs | Disponibilidade e responsividade |
| CI-02 | playwright-auth.cjs | Autenticação e acesso pela interface |
| CI-03 e CI-04 | playwright-persistence.cjs | Planos, persistência, edição e biblioteca |
| CI-05 | playwright-sintomas-clima.cjs | Sintomas e dados meteorológicos |
| CI-06 | playwright-treino-historico.cjs | Conclusão e histórico |
| CI-07 | playwright-seguranca.cjs | Isolamento e tentativa de inserção indevida |

## Como executar

Na aba Actions, selecione Verificação Técnica e Funcional do MVP e clique em Run workflow na branch main. O ambiente usa Node.js 22 e Playwright 1.58.2.

As credenciais das contas fictícias já estão configuradas nos secrets do GitHub Actions. Não é necessário cadastrá-las novamente para executar os testes neste repositório. O primeiro paciente está vinculado ao fisioterapeuta de teste.

Os scripts executam contra a aplicação publicada, não contra um servidor local. Alguns testes criam registros fictícios de sintomas, planos e treinos que permanecem no banco. O teste de persistência tenta excluir o plano que criou.

## Evidências

Os relatórios completos ficam nos artefatos de cada execução por até 90 dias, conforme o limite do repositório. O resumo sem dados de contas fica na pasta evidencias, na main, quando a gravação pelo workflow é permitida. Cada resumo identifica a execução, o commit e os resultados. Não publique credenciais ou registros de pacientes reais.

As baterias anteriores foram aprovadas em rodadas separadas após correções. A execução consolidada deve ser avaliada pelo seu próprio resultado. CI-03 e CI-04 compartilham um script. CT31 verifica o sentido inverso apenas quando o segundo paciente possui registros. CT32 testa uma tentativa de inserção indevida, não todas as operações possíveis. Os resultados não constituem certificação de segurança ou de conformidade com a LGPD.

Execução anterior de segurança: https://github.com/purpleaither/TCC2/actions/runs/45450952452

## Auditoria complementar

O workflow Auditoria complementar do MVP serve o código do checkout em loopback, identifica o commit efetivamente carregado e anexa evidências mesmo quando alguma etapa falha. Em pull requests do próprio repositório, ele também usa as contas fictícias já cadastradas para auditar telas autenticadas com o Supabase real.

Para executar a parte local em Linux, use Node.js 24, Chromium e um servidor estático. Em um terminal, inicie o servidor a partir da raiz do repositório.

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Em outro terminal, execute as verificações. Defina `CHROME_PATH` com o caminho do navegador instalado.

```sh
npm ci --prefix tests/auditoria
CHROME_PATH=/usr/bin/chromium node tests/auditoria/interface.mjs
CHROME_PATH=/usr/bin/chromium node tests/auditoria/lighthouse.mjs
node --test --test-isolation=none tests/auditoria/*.test.mjs
```

Os critérios e as limitações da metodologia estão no [plano complementar](../docs/PLANO_VERIFICACAO_TCC.md) e no [relatório de resultados](../docs/RESULTADOS_VERIFICACAO_TCC.md).
