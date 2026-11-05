# Editor online — estado atual

## Decisões do responsável

A própria página deve permitir criar cards, editar texto, organizar etapas e atividades, mudar cores/categorias e mover itens. O acesso de edição compartilhada foi liberado expressamente para **qualquer visitante**. Authentication anônima identifica as sessões sem exigir conta pessoal.

**Supervisão permanece controlada somente no Gantt.** O Trello mostra o espelho dessa etapa, sem edição independente.

## Implementação

- `page-editor-online.js` mantém a edição direta existente e acrescenta **Salvar para todos**, conflitos, rascunho recuperável e histórico.
- `editor-cloud.mjs` usa o SDK Firebase modular 12.5.0, Authentication anônima, snapshots confirmados pelo servidor e transações.
- `editor-model.mjs` normaliza dados, valida tamanhos e IDs, preserva cores/descrições e espelha a Supervisão.
- O modelo compartilhado atualiza `DATA`, `G` e `T`. Mudanças online também atualizam a Árvore do Gantt.
- `index.html` usa a estrutura compartilhada `main`; `editor-preview.html` usa `preview`, isolada da principal.
- A implementação local anterior `page-editor.js` está preservada, mas deixa de ser o módulo ativo da página principal.

## Banco

Projeto Firebase `escala-b9a22`, Firestore Standard `(default)`, São Paulo. Hospedagem do site continua no GitHub Pages.

Documento `escala_boards/{board}`:

- `schema`: 1.
- `revision`: inteiro crescente.
- `payload`: JSON normalizado da estrutura, limitado a 650000 bytes no cliente e nas regras.
- `updatedAt`: timestamp do servidor.
- `updatedBy`: UID da sessão que gravou.
- `backupId`: identificador da cópia anterior criada na transação.

Cada gravação cria `escala_boards/{board}/history/{backupId}`, com `revision`, `payload` anterior, `savedAt` e `savedBy`, e incrementa a revisão principal na mesma transação. A primeira gravação arquiva a estrutura inicial como versão 0.

O cliente compara a revisão de base com a versão atual. Uma gravação baseada em revisão antiga falha, preservando o rascunho. Não existe mesclagem automática de duas estruturas: a resolução é explícita e a versão substituída fica arquivada.

## Segurança e recuperação

As regras exigem autenticação para a estrutura, validam os campos e tamanhos do envelope, exigem revisão crescente e uma cópia fiel da versão anterior na mesma transação. As versões arquivadas não podem ser alteradas. A estrutura principal não pode ser apagada pelo cliente. Apenas caminhos `test-*` permitem limpeza pelos testes.

O JSON interno é validado pelo modelo no cliente; as regras verificam o envelope e o tamanho, não interpretam o JSON. Como qualquer visitante foi autorizado a editar, um visitante malicioso pode tentar publicar conteúdo inválido ou indesejado. A interface rejeita modelos inválidos, preserva a estrutura local e oferece restauração de versões. O histórico e a exportação são mecanismos de recuperação, não uma restrição de quem pode editar.

Textos editados são apresentados como texto; não devem ser interpolados em HTML. Não armazenar dados privados neste editor público. UIDs não são identidades verificadas.

I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for authenticated anonymous collaboration with bounded payloads, atomic backups, and monotonic revisions. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.

## Rascunhos e compatibilidade

A chave local da estrutura principal continua `escala:editor:local:v1`. O rascunho inclui o modelo, a revisão de base e a indicação de alterações não publicadas. Rascunhos anteriores são preservados; se houver uma versão online diferente, o visitante decide qual conteúdo carregar/publicar.

Durante um salvamento, novas edições locais não são descartadas. Snapshots em cache ou com escritas pendentes não confirmam publicação. Se o servidor estiver indisponível, a página mantém o rascunho e apresenta reconexão.

## Testes realizados em 05/11/2026

- 8 testes locais do modelo e da serialização, incluindo limites UTF-8.
- 21 verificações básicas no Firebase real com duas sessões de UIDs distintos.
- 22 verificações na variação que lê o conteúdo enviado pela interface de outra sessão.
- 23 verificações na variação que também publica uma atualização conflitante de outra sessão.
- Bloqueios: sobrescrita de revisão antiga, falta de backup, campos extras, payload grande, salto de revisão, UID forjado, acesso sem autenticação, histórico adulterado, alteração de versões, exclusão da estrutura principal e caminhos não autorizados.
- Concorrência: duas tentativas simultâneas produziram uma única gravação aceita.
- Interface: persistência após recarga, preservação de rascunho conflitante, carregamento de versão online, restauração de histórico e salvamento/recuperação de novo card.
- A prévia foi restaurada à estrutura original após os testes.

## Operação

Publicar código na `main` aciona o GitHub Pages. Publicar regras é uma operação separada no Firebase. Testar mudanças de persistência na prévia antes de ativá-las na principal. Não apagar documentos compartilhados para simular testes.

O histórico exibe as dez últimas cópias anteriores; não há expurgo automático. Duplicação de cards e importação JSON continuam como possíveis melhorias, não requisitos concluídos nesta entrega.
