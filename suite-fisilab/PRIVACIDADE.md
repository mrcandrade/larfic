# Privacidade e segurança na Suíte FisiLab

Este aviso explica, para alunos e para quem administra computadores da UFRGS, o que os programas da
Suíte FisiLab fazem com os seus dados. Ele foi escrito a partir de uma auditoria do código-fonte de
cada programa (outubro de 2026).

## Resumo

- **Nenhum programa da suíte coleta dados de uso.** Não há telemetria, estatísticas, envio de
  relatórios de falha nem verificação automática de atualizações.
- **Ao instalar e usar normalmente, nenhum programa se conecta à internet.** As poucas conexões que
  existem acontecem só quando você pede (veja abaixo) e nunca enviam o conteúdo dos seus arquivos.
- **Tudo o que os programas guardam fica no seu computador**, na sua pasta de usuário.

## Quando um programa usa a internet (só se você pedir)

| Programa | Ação | O que é enviado |
|---|---|---|
| PDF | Ajuda › Verificar atualizações | Só o endereço IP e a versão do programa (consulta ao GitHub) |
| Efeitos | Baixar os modelos de IA de recorte (Roto Brush) e de rastreamento de rosto, em Configurações | Só o endereço IP (download do GitHub e do Google Storage) |
| Revela | Baixar os modelos de rostos e de redução de ruído (depois de aceitar os termos) | Só o endereço IP (download do GitHub e do Hugging Face) |
| Revela | Baixar a lista de nomes de cidades para geocodificação | Só o endereço IP (download do GeoNames). A localização das fotos **nunca** é enviada: a busca é feita no seu computador |
| Revela | Botão "Mostrar no mapa" | Abre o OpenStreetMap no navegador com as coordenadas da foto escolhida |
| Todos | Clicar em um link (Ajuda, Sobre, links em documentos) | Abre a página no seu navegador. Links em documentos só abrem após confirmação, e só `http`, `https` e `mailto` |

Os modelos baixados são conferidos por soma de verificação (SHA-256) antes de serem usados.

## O que fica guardado no seu computador

Cada programa guarda, na sua pasta de usuário (`%APPDATA%\FisiLab …` no Windows; `~/.config/fisilab-…`
e `~/.local/share/fisilab-…` no Linux):

- **Preferências** e a **lista de arquivos recentes**, com o caminho completo dos arquivos;
- **Registros (logs)** de funcionamento, que podem conter nomes e caminhos de arquivos, nunca o
  conteúdo dos documentos;
- **Cópias de recuperação** dos documentos com alterações não salvas (Foto, PDF, Slides, Layout,
  CAD, Filme, Efeitos). Elas servem para recuperar o trabalho depois de uma falha e são apagadas ao
  salvar ou fechar o documento — mas ficam no disco se o programa travar;
- No **Revela**, a biblioteca de fotos com os metadados das fotos (inclusive a localização GPS que a
  câmera gravou) e, se você usar o reconhecimento de rostos, os **dados de rosto** (nomes e "vetores"
  de reconhecimento) na pasta da biblioteca. Esses dados são considerados **biométricos** pela LGPD:
  use esse recurso só com fotos e pessoas que consentiram, e apague a pasta da biblioteca para
  removê-los.

Nada disso é enviado para fora do seu computador. Esses arquivos **não são criptografados**.

### Computadores compartilhados (laboratórios)

Em um computador usado por várias pessoas com a **mesma conta do Windows**, outra pessoa pode ver a
sua lista de arquivos recentes e as cópias de recuperação. Recomendações:

- use uma conta do Windows própria, ou
- ao terminar, feche os programas normalmente (isso apaga as cópias de recuperação) e apague a pasta
  `%APPDATA%\FisiLab …` do programa que usou, ou
- use o modo portátil (um arquivo `portable.txt` ao lado do executável faz os dados ficarem na mesma
  pasta, por exemplo num pendrive seu).

## Cuidados de segurança adotados

- **Macros e scripts de documentos não são executados.** Macros do Word e do Excel são preservadas no
  arquivo, mas o Texto e a Planilha nunca as rodam (atenção: elas podem rodar se o arquivo for aberto
  depois no Microsoft Office). O JavaScript de PDFs roda isolado, sem acesso a arquivos ou à rede, e
  formulários "enviar" não enviam nada.
- **Arquivos externos referenciados por documentos não são baixados**: imagens e vídeos "vinculados"
  a apresentações, modelos de documentos online e caminhos de rede (`\\servidor\...`) são ignorados.
  Isso impede que um arquivo malicioso descubra quem o abriu ou capture a senha do Windows.
- **No CAD**, referências externas (xrefs) para caminhos de rede não são abertas automaticamente.
- **No Layout**, imagens vinculadas de um arquivo IDML só são lidas da pasta do próprio documento, e
  arquivos compactados maliciosos (que se expandem para tamanhos enormes) são recusados.
- **No Efeitos**, scripts `.jsx` que você executar não podem gravar arquivos fora da pasta do projeto
  nem acessar a rede. Só um administrador pode liberar isso (variável de ambiente
  `EFFECTCRAFT_ALLOW_SCRIPT_IO=1`).
- **No Texto e na Planilha**, o salvamento automático (que grava por cima do arquivo aberto) vem
  **desligado**; ative-o nas opções se quiser.
- Os programas têm um **canal de automação** para scripts e agentes de IA, que fica **desligado** e só
  liga se o programa for iniciado com `--control`. Ele aceita conexões apenas do próprio computador.
  Não o ative em computadores compartilhados.

## Instaladores

Os instaladores ainda não têm assinatura digital, por isso o Windows mostra o aviso "O Windows protegeu
o computador". Para conferir se um instalador é o original, compare o SHA-256 dele (no PowerShell:
`Get-FileHash arquivo.exe`) com o publicado no arquivo `SHA256SUMS.txt` da página de downloads
(https://github.com/mrcandrade/larfic/releases/latest).

## Contato

Dúvidas ou problemas de privacidade e segurança: abra uma *issue* no repositório do programa ou
escreva para o FisiLab. Os programas são software livre: qualquer pessoa pode conferir o código.
