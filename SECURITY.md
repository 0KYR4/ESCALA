# Configuração pública e segurança

A chave `apiKey` em `firebase-config.js` é a identificação pública do app web Firebase. O navegador precisa recebê-la para usar Authentication e Firestore. Movê-la para uma variável de ambiente durante a geração do site não a torna secreta no navegador.

Em 05/11/2026, as restrições dessa chave no Google Cloud foram reduzidas de 25 APIs para **Cloud Firestore API, Identity Toolkit API e Token Service API**. Não autorizar APIs de IA, Maps ou outros produtos nessa chave. Restrições por site não estão ativadas; as ferramentas de teste também usam a chave sem navegador.

O acesso aos dados é controlado pelas regras do Firestore: rascunhos são privados da identidade autenticada, e a versão compartilhada permite edição por qualquer visitante autenticado anonimamente, conforme decisão do responsável. UIDs anônimos não são contas pessoais nem sincronizam identidades entre dispositivos.

A revisão dos arquivos do repositório não encontrou credenciais administrativas ou chaves privadas. Não incluir arquivos de conta de serviço, chaves privadas, tokens de acesso ou informações internas. Caso uma credencial privada seja adicionada, revogá-la na origem e tratar também o histórico Git; apenas apagar o arquivo não revoga a credencial.

Referência: https://firebase.google.com/docs/projects/api-keys
