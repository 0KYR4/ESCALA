## Atualização — edição diretamente nos cards

O botão **Editar nos cards** ativa textos editáveis na própria visão Gantt × Trello. Os títulos, nomes de etapas e textos de atividades são alterados no local, sem formulário ou modal. Controles discretos junto aos itens permitem adicionar, excluir com confirmação, reordenar e mover atividades por arraste ou seleção de destino. A Supervisão do Trello permanece somente para consulta e reflete as alterações do Gantt.

Há rascunho local recuperável, desfazer/refazer e exportação JSON. **Concluir edição** mantém o resultado na visualização da sessão. Após recarregar, entre novamente no editor para recuperar o rascunho. Nenhuma regra Firebase foi alterada ou implantada. Ainda faltam salvamento para todos, revisões compartilhadas, aviso de concorrência e duplicação de cards. Os comentários foram preservados. O histórico abaixo descreve o estado anterior e o objetivo completo.

# Continuidade — editor visual da ESCALA

## Pedido e decisão de acesso

Transformar a própria página em uma estrutura editável: adicionar cards, editar textos, alterar ordem, mover atividades e reorganizar etapas. Os comentários isolados não atendem a esse objetivo.

**Decisão expressa do responsável:** qualquer visitante pode editar a estrutura compartilhada. Não adicionar exigência de login Google ou lista de editores sem uma nova solicitação. Authentication anônima pode continuar identificando as sessões de forma transparente.

O trabalho foi interrompido por solicitação do responsável para subir o estado atual ao GitHub, com documentação, e continuar a edição online. Não considerar o editor pronto.

## O que existe

- Site funcional no GitHub Pages: `https://0kyr4.github.io/ESCALA/`.
- Firebase real: projeto `escala-b9a22`, app ESCALA, Firestore Standard `(default)`, `southamerica-east1`, plano Spark.
- Authentication anônima ativada; domínio `0kyr4.github.io` autorizado.
- Comentários online já publicados e testados. Os dados dos serviços continuam embutidos no `index.html`.
- **Novo arquivo `editor-model.mjs`:** modelo inicial de pares Gantt/Trello, importação dos dados atuais, normalização, criação de cards/etapas/atividades, reordenação e movimentação de atividades.

## Limites do estado atual

- `editor-model.mjs` não é importado pelo site e ainda não possui interface.
- Não há gravação compartilhada da estrutura editável nem histórico de versões no Firestore.
- As regras atuais autorizam apenas a coleção de comentários. Elas não autorizam alterações no modelo dos cards.
- Não foi criada uma coleção de edição nem migrada a estrutura para o banco.
- Os testes reais existentes cobrem os comentários. No modelo novo passaram verificações de sintaxe, importação dos 25 pares, normalização, movimentação básica, espelhamento da Supervisão, bloqueio de movimentação da Supervisão para o Trello e sincronização com `DATA`, `G` e `T`. Essas verificações não substituem testes completos da futura interface e persistência.

## Comportamento pretendido

1. Exibir um botão **Editar página** na própria tela.
2. Permitir adicionar, duplicar, remover e reordenar pares de cards.
3. Editar títulos, descrições, nomes e ordem das etapas e textos das atividades.
4. Mover atividades por arraste e por controles acessíveis, inclusive entre etapas/cards quando permitido.
5. Manter alterações em um rascunho até **Salvar para todos**; avisar quando outra pessoa publicar durante uma edição.
6. Salvar revisões e oferecer restauração de versões para recuperar alterações acidentais.
7. Atualizar as duas visões e a navegação a partir do mesmo modelo, sem duplicar dados independentes.
8. Remover os controles de comentários da interface principal se forem substituídos pelo editor. Não apagar comentários existentes automaticamente.

## Regra de Supervisão

**Somente o Gantt controla a Supervisão.** A etapa no Trello é derivada do Gantt e não pode ser editada de forma independente. O modelo inicial espelha essa etapa após normalizar ou mover atividades e rejeita destinos de Supervisão no lado Trello.

Atividades de Supervisão só podem sair de sua etapa para outra Supervisão do lado Gantt. Revisar essa regra e testar suas bordas ao construir a interface.

## Próximos passos

- Revisar e testar o modelo: adicionar/remover/reordenar, mover no mesmo grupo e entre grupos, IDs duplicados, limites de tamanho e espelhamento da Supervisão.
- Criar a interface de edição diretamente nos cards, com confirmação dentro da página para exclusões. Evitar `prompt()`/`confirm()` nativos: eles bloquearam o navegador integrado nos testes anteriores.
- Implementar persistência com revisão/controle de concorrência, cópia de segurança e recuperação de rascunhos. Não sobrescrever silenciosamente alterações feitas por outro visitante.
- Definir um esquema de banco limitado à estrutura da ESCALA. Validar campos e tamanhos nas regras, tanto em criação quanto atualização; negar os demais caminhos. Edição pública foi autorizada, mas isso não autoriza acesso a outras coleções ou credenciais.
- Implantar e testar regras no Firebase real. Um commit com regras não as implanta no serviço.
- Testar em uma prévia e em sessões independentes, limpar os dados temporários e só então publicar a interface em `index.html`.
- Atualizar este documento e o README com o resultado efetivamente verificado.

## Atenções de implementação

- O script principal usa as variáveis globais `DATA`, `G` e `T`. O modelo pode atualizar seus conteúdos, preservando os vínculos usados pelas funções existentes.
- `applyToData()` é uma base para essa sincronização. Revisar nomes de card e etapa, campos originais preservados e a classificação dos serviços.
- Há contagens fixas na interface atual (como “25 pares” e “16 serviços principais”); torná-las dinâmicas.
- Há uso legado de `innerHTML` na apresentação de detalhes. Antes de aceitar texto editável do banco, substituir as interpolações por `textContent`/criação segura de elementos.
- Tratar snapshots inválidos com recuperação de versão; não renderizar HTML de visitantes.
- Os nomes de domínio, chaves públicas do app e IDs do Firebase podem constar no cliente; chaves privadas e tokens administrativos não podem constar neste repositório público.
