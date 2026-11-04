# ESCALA

Mapa de serviços com duas visões: **Árvore do Gantt V2** e **Gantt V2 × Trello**.

- [Abrir o site](https://0kyr4.github.io/ESCALA/)
- [Editar os arquivos online no GitHub.dev](https://github.dev/0KYR4/ESCALA)
- [Continuar o editor visual da página](EDITOR_ONLINE.md)
- [Configuração e testes do Firebase](FIREBASE_COMENTARIOS_SETUP.md)

## Estado deste projeto

O site publicado usa GitHub Pages. Os comentários compartilhados usam Firebase Authentication anônima e Cloud Firestore, no projeto **ESCALA** (`escala-b9a22`), região São Paulo. Firebase Hosting não está configurado.

**A edição visual de cards ainda não está concluída.** O estado atual foi enviado ao GitHub para permitir a continuidade online. O arquivo `editor-model.mjs` inicia o modelo de dados do futuro editor; ele ainda não é carregado pela página. O site continua exibindo a versão já validada com comentários.

O próximo objetivo é permitir criar cards, editar títulos e atividades, mudar a ordem e mover itens, salvando a estrutura online. O responsável escolheu permitir edição por **qualquer visitante**. A Supervisão continua sendo controlada somente pelo Gantt; o Trello mostra seu espelho.

## Editar online

1. Abra [GitHub.dev](https://github.dev/0KYR4/ESCALA), com uma conta que tenha permissão de escrita neste repositório.
2. Edite os arquivos e faça um commit para a branch `main` pelo painel de controle de versão.
3. Acompanhe a publicação em [Actions](https://github.com/0KYR4/ESCALA/actions).
4. Confira o resultado no [site](https://0kyr4.github.io/ESCALA/).

Também é possível abrir um arquivo no GitHub e usar o botão de edição. Alterar `firestore.rules` no repositório **não publica automaticamente** as regras no Firebase: elas precisam ser implantadas separadamente.

## Arquivos

| Arquivo | Finalidade |
| --- | --- |
| `index.html` | Página principal, estilos e dados originais do mapa |
| `firebase-preview.html` | Prévia da integração de comentários |
| `firebase-comments.js` | Envio, leitura, edição e exclusão dos comentários online |
| `firebase-config.js` | Configuração pública do app web Firebase |
| `firestore.rules` | Regras atualmente usadas para comentários |
| `editor-model.mjs` | Modelo inicial do editor visual, ainda sem interface ou persistência |
| `tests/firebase-smoke.mjs` | Testes de integração dos comentários contra o Firebase real |
| `.github/workflows/deploy-pages.yml` | Publicação do site no GitHub Pages |

## Verificações realizadas

- Comentários: 20 verificações de integração no Firebase real; uma execução com `--verify-ui` passou em 21 verificações, incluindo leitura de um comentário criado na interface por outra sessão.
- Interface dos comentários: envio, persistência após recarga, edição, cancelamento e confirmação de exclusão.
- Estrutura Gantt/Trello preservada na publicação dos comentários.
- O editor visual ainda precisa ser implementado e validado; os testes dos comentários não validam esse futuro recurso.

O teste `node tests/firebase-smoke.mjs` cria e remove dados e contas temporárias no Firebase real. A opção `--verify-ui` exige o comentário temporário específico previsto no script; esse comentário já foi removido após a validação anterior.

## Dados públicos

O repositório, o site e os comentários são públicos. Não inclua informações internas, dados de clientes, senhas, tokens administrativos ou arquivos de conta de serviço. A configuração web em `firebase-config.js` contém identificadores públicos; a proteção do banco depende das regras do Firestore.
