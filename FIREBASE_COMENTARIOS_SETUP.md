# Atualização — editor compartilhado

Em 05/11/2026, o editor recebeu salvamento da estrutura no Firestore, controle de revisão e histórico. Veja README.md e EDITOR_ONLINE.md para a operação atual. Este documento preserva a configuração e os testes anteriores dos comentários. Os comentários existentes não foram apagados; a página principal usa o editor de cards. As regras atuais também incluem escala_boards e histórico.

# ESCALA — comentários online

## Situação
A implementação usa um projeto Firebase separado chamado **ESCALA**, com ID `escala-b9a22`.
O projeto anterior `escala-comentarios` foi excluído a pedido do responsável.
Authentication anônima está ativada; o Firestore Standard `(default)` foi criado em `southamerica-east1` (São Paulo), com as regras de `firestore.rules` publicadas.
O domínio `0kyr4.github.io` está autorizado. O app web chama-se ESCALA.
O plano é Spark; não foi vinculado faturamento. Analytics e Gemini não foram ativados.

## Validação
- Em 04/11/2026, `node tests/firebase-smoke.mjs` passou em 20 verificações contra o Firebase real.
- Duas sessões anônimas com UIDs distintos: criar, consultar por serviço, ler na outra sessão, editar pelo dono, refletir edição, excluir pelo dono e confirmar remoção.
- Bloqueios confirmados: edição/exclusão por outro usuário, texto vazio ou acima de 2000 caracteres, mudança de proprietário ou serviço, campos extras, proprietário forjado, gravação sem autenticação e gravação fora da coleção de comentários.
- Os comentários e as contas temporárias desse teste foram removidos ao terminar. O teste não usa nem imprime credenciais administrativas.
- A prévia `firebase-preview.html` foi testada no GitHub Pages: envio real, comentário persistente após recarga, mesmo comentário nas visões Árvore e Gantt × Trello, botão de atividade selecionando o destino correto.
- `node tests/firebase-smoke.mjs --verify-ui` passou em **21 verificações**, incluindo a leitura do comentário enviado pela interface por uma nova sessão anônima independente.
- Edição e exclusão usam controles dentro da própria página, evitando janelas nativas que bloqueavam o navegador integrado.
- Na interface da prévia, passaram: editar e salvar, cancelar a exclusão preservando o comentário, confirmar exclusão e observar a lista vazia. O comentário temporário da interface foi removido.
- Confirmada a restauração do serviço selecionado quando o Firebase termina de carregar. Os scripts são versionados `escala-b9a22-3`.
- Após a validação, `index.html` recebeu o mesmo conteúdo da prévia. Os dados originais do Gantt/Trello foram comparados e preservados.

## Hospedagem
- Site: GitHub Pages, em `https://0kyr4.github.io/ESCALA/`.
- Banco e login dos comentários: Firebase (Firestore e Authentication).
- **Firebase Hosting não foi configurado.** A integração não altera a hospedagem do site.

## Como ativar
1. Usar o projeto **ESCALA** (`escala-b9a22`), sem criar outro projeto.
2. Registrar um app Web com o domínio **0kyr4.github.io** autorizado no Firebase Authentication.
3. Ativar **Authentication > Sign-in method > Anonymous** (o visitante não precisa entrar com usuário/senha).
4. Criar um banco **Cloud Firestore** em modo de produção e aplicar as regras de `firestore.rules` na aba Rules.
5. Copiar a configuração web oficial fornecida pelo Firebase para `firebase-config.js` como `window.ESCALA_FIREBASE_CONFIG = { apiKey: '...', authDomain: '...', projectId: '...', appId: '...' }`.
   A configuração web é identificador público do projeto, não uma chave de acesso administrativo. **Nunca colocar service account/private key no GitHub.**
6. Testar a publicação de um comentário em `https://0kyr4.github.io/ESCALA/firebase-preview.html` em dois navegadores diferentes. Confirmar que ambos veem o mesmo texto e que editar/excluir obedece às regras do dono.
7. Depois do teste, substituir `index.html` pelo conteúdo da prévia e publicar via GitHub Pages.

## Comportamento esperado
- Comentários ficam no Firestore, associados ao serviço e à atividade selecionada.
- Todos os visitantes da página podem ler os comentários.
- Visitantes criam comentários sem conta pessoal; no fundo usam Firebase Anonymous Authentication.
- O nome é informado pelo integrante e não comprova identidade.
- Apenas a sessão anônima que criou o comentário poderá editar/excluir; se o navegador for limpo, isso pode deixar de ser possível.
- Supervisão permanece controlada exclusivamente no Gantt. Comentários não alteram tarefas nem estados do Gantt/Trello.

## Privacidade e segurança
**O repositório e o site são públicos.** As regras do exemplo permitem leitura pública, portanto nunca incluir dados sensíveis, dados de clientes ou informações restritas.
As regras validam os campos e restringem edição/exclusão ao criador, mas **não impedem spam por visitantes anônimos**.
Para uso de equipe, recomenda-se ativar Firebase App Check, monitoramento/cotas e alguma forma de controle de acesso, caso comentários devam ser privados.
Se a equipe desejar comentários restritos, substituir o Anonymous por um login Google/Microsoft aprovado e ajustar as regras antes da publicação.
