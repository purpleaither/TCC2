# TCC2 - Continuidade do cuidado fisioterapêutico

Protótipo acadêmico com perfis **demonstrativos** de fisioterapeuta e paciente. Não é destinado a uso clínico ou armazenamento de dados reais de saúde.

## Funcionalidades

- Fisioterapeuta fictício: selecionar paciente fictício, configurar planos e consultar registros.
- Paciente fictício: consultar exercícios prescritos, registrar sintomas, consultar histórico e clima.
- Biblioteca ExerciseBank: consultar catálogo, selecionar exercícios e assistir a vídeos licenciados quando disponíveis.
- Open-Meteo: consulta contextual por município, sem automatização de condutas clínicas.

## ExerciseBank - configuração segura na Vercel

1. **Revogue a chave previamente compartilhada** e gere outra em https://exercisebank.net/.
2. Vercel > projeto > Settings > Environment Variables: crie `EXERCISEBANK_API_KEY` com a **nova** chave (ambientes apropriados).
3. Faça um novo deploy para disponibilizar a variável à função `api/exercisebank.js`.
4. No protótipo, entre como fisioterapeuta demonstrativo e abra **Biblioteca ExerciseBank**.

**Nunca inclua a chave no HTML, em `mvp.js`, em `NEXT_PUBLIC_*` ou no GitHub.** A API é chamada por função serverless, e o navegador só recebe os metadados e URLs temporárias da mídia.

A licença sandbox gratuita permite explorar o catálogo, mas limita os vídeos a uma amostra de 50 exercícios e é voltada a desenvolvimento/demonstração; confira os termos antes de disponibilizar o produto publicamente. O proxy público não tem autenticação nem limitação de tráfego por usuário; não use em produção até implementar controles de acesso e limitação de solicitações.

## Limitações metodológicas

- **Sem autenticação real**, autorização no servidor ou banco de dados compartilhado.
- Dados fictícios salvos somente em `localStorage`, isolados por navegador, não por credencial segura.
- Sem testes com pacientes ou profissionais reais, validação clínica ou eficácia terapêutica.
- Biblioteca ExerciseBank é majoritariamente voltada ao exercício físico, não substitui curadoria por fisioterapeuta nem garante cobertura de fisioterapia respiratória.
- Vídeos são obtidos de links temporários da API, não hospedados localmente.

Arquivos anteriores (`app.js` e `style.css`) foram preservados para consulta; a interface atual usa `index.html`, `mvp.js` e `mvp.css`.
