# Guia para atividades em áreas verdes

Na ficha do exercício em **Meus exercícios**, o botão **Ver parques próximos** abre uma janela sobre o exercício quando a consulta autenticada confirma pelo menos um exercício vinculado aos seus planos com indicação ao ar livre. A aplicação não tem um campo separado para indicar ao ar livre as orientações livres do plano ou um estado de arquivamento. Nesta versão, os exercícios dos planos atribuídos são os exercícios ativos. A decisão clínica continua com o fisioterapeuta.

## Dados e privacidade

A localização é usada em memória e arredondada a três casas decimais antes das consultas ao Overpass e à Open-Meteo. A escolha de uma região usa um ponto representativo, que pode ficar afastado do seu núcleo urbano. O guia não transmite identificadores de pacientes, nomes de exercícios ou dados do diário aos serviços externos. O registro meteorológico fixo de Brasília, já existente no diário de sintomas, constitui um fluxo separado e não utiliza a localização do guia.

Os pontos dos parques são aproximações derivadas das poligonais oficiais. A distância exibida é estimada pela rede pedonal da FOSSGIS até um ponto mapeado do parque, que pode ficar longe da entrada. O sistema avalia até 12 candidatos próximos e descarta rotas cujo ponto na rede esteja a mais de 150 m da origem ou do destino informado. A FOSSGIS recebe a origem aproximada e pode registrar a consulta. O cartão mostra distância e tempo estimado do menor percurso entre as alternativas que o roteador devolve. O mapa aceita arraste e setas do teclado. A seleção por nome permite chegar a qualquer parque consultado. Uma entrada associada ao parque e identificada como utilizável tem preferência sobre o ponto aproximado do parque. A rota pedonal não é uma avaliação de acessibilidade. A base local serve de reserva quando o Overpass não retorna resultados. O mapa de ruas usa as imagens do OpenStreetMap para a área aproximada da consulta, carregadas conforme a visualização. Os marcadores são numerados por distância. Se o fundo de ruas estiver indisponível, a visualização usa os limites do DF armazenados no aplicativo. As categorias da base local seguem as fontes cartográficas.

- Parques do Distrito Federal, IPEDF e Brasília Ambiental. [Metadados](https://catalogo.ipe.df.gov.br/layers/geonode%3AParques_IBRAM/metadata_detail)
- Parques urbanos, Geoportal DF. [Camada oficial](https://www.geoservicos.ide.df.gov.br/arcgis/rest/services/Publico/EQUIPAMENTOS_URBANOS/FeatureServer/7)
- Regiões administrativas do DF. [Metadados do IPEDF](https://catalogo.ipe.df.gov.br/layers/geonode%3Aregioes_administrativas/metadata_detail)
- Parques complementares. [Contribuidores do OpenStreetMap](https://www.openstreetmap.org/copyright)
- Previsão e estimativas regionais. [Open-Meteo Forecast](https://open-meteo.com/en/docs) e [Open-Meteo Air Quality / CAMS](https://open-meteo.com/en/docs/air-quality-api)

O valor de 500 ppm de CO₂ é uma referência operacional de exibição para o texto educativo. Os valores regionais de CO₂ e os demais indicadores não são medições no parque e não determinam a segurança de um treino. O guia não cancela, modifica ou inicia exercícios.

## Banco e verificação

A migração adiciona a coluna com valor padrão falso e envia alterações pelo Supabase Realtime por meio da tabela de planos, respeitando a leitura existente por participante. O painel reconsulta a indicação ao entrar, quando a aba volta a ficar visível e a cada 15 segundos enquanto o painel está visível. O formulário consulta a indicação de novo antes de enviar dados de localização. Os indicadores ambientais foram retirados do pop-up. A consulta ao abrir o mapa se limita a parques e rotas. O conselho educativo sobre os sintomas do dia fica no Início.

O caso CT54 verifica, com contas fictícias, a edição do campo pelo fisioterapeuta, a atualização do painel do paciente após marcar e desmarcar, e a ausência de chamadas ambientais antes da escolha de uma localização.

## Acompanhamento do trajeto

**Iniciar trajeto** solicita localização contínua durante a sessão em primeiro plano e atualiza o ponto do paciente no mapa. As instruções em português mostram a próxima manobra e sua distância estimada. O recálculo exige pelo menos duas posições fora da rota, leva em conta a precisão informada pelo aparelho e respeita intervalo mínimo de 15 segundos. A tela encerra a localização ao fechar o pop-up, sair da aba ou selecionar outro parque. A posição detalhada fica em memória. O roteador recebe somente a origem arredondada para o cálculo da rota.
