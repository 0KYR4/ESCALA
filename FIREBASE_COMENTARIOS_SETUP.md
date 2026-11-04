# ESCALA — comentários online

## Situação
A versão atual do site (index.html) continua publicada.
A implementação online está preparada em `firebase-preview.html`, `firebase-comments.js`, `firebase-config.js` e `firestore.rules`.
**O recurso online ainda NÃO está ativo**, pois depende de configurar um projeto Firebase real. Não colocar dados fictícios no arquivo de configuração.

## Como ativar
1. Criar ou conectar um projeto Firebase da organização.
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
