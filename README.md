# ESCALA

Mapa editável com **Árvore do Gantt V2** e **Gantt V2 × Trello**.

- [Abrir o site](https://0kyr4.github.io/ESCALA/)
- [Editar o código no GitHub.dev](https://github.dev/0KYR4/ESCALA)
- [Arquitetura e continuidade](EDITOR_ONLINE.md)
- [Prévia isolada do editor](https://0kyr4.github.io/ESCALA/editor-preview.html)

## Editar e salvar para todos

Clique nos títulos, etapas ou atividades para editar diretamente. Use **Novo cartão**, **Cor**, **Tipo de etapa**, **Adicionar etapa** e **Adicionar atividade** para organizar a estrutura. É possível reordenar, mover atividades, desfazer/refazer e exportar JSON.

Clique em **Salvar para todos** para publicar o rascunho no Firebase. Aguarde a mensagem **Salvo online · versão …**. As outras sessões recebem a estrutura em tempo real. Alterar os cards não gera commits no GitHub: os dados compartilhados ficam no Firestore.

As alterações ainda não publicadas ficam neste navegador e em um rascunho privado no servidor, salvo somente quando o conteúdo muda. O rascunho pertence à identidade anônima deste navegador; não há login entre dispositivos. Se outra pessoa publicar enquanto você edita, o rascunho será preservado e aparecerá **Revisar atualização**. Você pode carregar a versão online ou confirmar a publicação do próprio rascunho sobre ela; uma cópia da versão substituída fica no histórico.

Em **Histórico**, use **Comparar com o atual** para ver diferenças com seu rascunho, ou escolha uma versão e confirme sua restauração como rascunho. Use **Salvar para todos** para torná-la a versão atual. O painel mostra as dez últimas versões anteriores; as demais continuam armazenadas no banco.

**Qualquer visitante pode editar**, conforme a escolha do responsável. A Supervisão é controlada exclusivamente pelo Gantt e espelhada no Trello.

## Hospedagem e dados

- Site e código: GitHub Pages / GitHub.
- Dados: Cloud Firestore e Authentication anônima, projeto **ESCALA** (`escala-b9a22`).
- Firestore Standard `(default)`, região `southamerica-east1` (São Paulo), plano Spark.
- Firebase Hosting não está configurado.
- A página principal não carrega os widgets de comentários. Os comentários antigos e a prévia `firebase-preview.html` foram preservados.

O repositório e o conteúdo são públicos. Não inclua dados internos, dados de clientes, senhas, tokens administrativos ou chaves de conta de serviço. A configuração web contém identificadores públicos do app.

## Arquivos principais

| Arquivo | Função |
| --- | --- |
| `index.html` | Página principal e estrutura inicial |
| `page-editor-online.js` | Edição nos cards, rascunhos, conflitos, salvamento e histórico |
| `editor-cloud.mjs` | Firebase, transações e revisões |
| `editor-model.mjs` | Validação, movimentação e espelho de Supervisão |
| `page-editor.css` | Estilos do editor |
| `editor-preview.html` | Mesma implementação em uma estrutura de teste separada |
| `firestore.rules` | Regras do editor, histórico e comentários antigos |
| `firebase-config.js` | Configuração pública do Firebase |
| `page-editor.js` | Implementação local anterior, preservada como referência |

## Verificações

Em 05/11/2026: **19 testes locais** passaram. Os testes contra o Firebase real passaram em **21 verificações básicas**, **22 com leitura de uma gravação feita pela página** e **23 com publicação conflitante de uma sessão independente**. São variações do mesmo roteiro, não somas de testes distintos.

Na interface da prévia foram verificados: salvar, recarregar, conflito sem perda do rascunho, carregar a versão de outra sessão, restaurar pelo histórico, criar e salvar um novo card, recuperar esse card após recarga e restaurar a estrutura original da prévia.

- Testes locais: `node --test tests/editor-model.test.mjs tests/editor-cloud.test.mjs tests/editor-autosave.test.mjs tests/editor-compare.test.mjs`.
- Integração real: `node tests/editor-cloud-smoke.mjs`. Cria e limpa uma estrutura e contas temporárias sob caminhos `test-*`.
- As opções `--verify-preview` e `--write-preview-conflict` são testes dirigidos: dependem do estado previsto da prévia. A segunda altera a prévia, nunca a estrutura principal.

## Publicar alterações de código

Faça commit na branch `main` e acompanhe [Actions](https://github.com/0KYR4/ESCALA/actions). Atualize a versão nos URLs dos scripts quando necessário para evitar cache antigo.

Um commit em `firestore.rules` **não implanta as regras no Firebase**. Elas precisam ser publicadas separadamente no projeto correto. Consulte `EDITOR_ONLINE.md` antes de alterar o esquema.


A revisão da configuração pública e das restrições de API está em [SECURITY.md](SECURITY.md).
