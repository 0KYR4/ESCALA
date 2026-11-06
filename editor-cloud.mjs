// Persistência compartilhada. Cada gravação arquiva a versão anterior na mesma transação.
export class RevisionConflict extends Error {
  constructor() { super('Outra pessoa publicou uma versão mais recente. Seu rascunho foi preservado.'); this.code='revision-conflict'; }
}
export function serializeModel(model, normalize) {
  const payload=JSON.stringify(normalize(model));
  if(new TextEncoder().encode(payload).length>650000)throw Error('Estrutura muito grande para salvar. Exporte uma cópia e reduza o conteúdo.');
  return payload;
}
export async function connectEditor({config,board='main',seed,onVersion,onError}) {
  if(!config?.apiKey||!config?.projectId)throw Error('Configuração do Firebase ausente.');
  if(!/^(main|preview|test-[a-z0-9-]{1,40})$/.test(board))throw Error('Destino de edição inválido.');
  const version='12.5.0',cdn='https://www.gstatic.com/firebasejs/'+version+'/';
  const [app,auth,db]=await Promise.all([import(cdn+'firebase-app.js'),import(cdn+'firebase-auth.js'),import(cdn+'firebase-firestore.js')]);
  const instance=app.getApps().length?app.getApp():app.initializeApp(config);
  const identity=(await auth.signInAnonymously(auth.getAuth(instance))).user;
  const firestore=db.getFirestore(instance),ref=db.doc(firestore,'escala_boards',board);
  const draft=db.doc(ref,'drafts',identity.uid);
  const stop=db.onSnapshot(ref,{includeMetadataChanges:true},snap=>{
    // Cache local não confirma o estado compartilhado nem autoriza uma gravação.
    if(snap.metadata.fromCache||snap.metadata.hasPendingWrites)return;
    onVersion(snap.exists()?snap.data():{revision:0,payload:seed});
  },onError);
  return {
    stop,
    async readDraft(){const snapshot=await db.getDocFromServer(draft);return snapshot.exists()?snapshot.data():null;},
    async saveDraft({payload,baseRevision}) {
      await db.setDoc(draft,{schema:1,payload,baseRevision:baseRevision??0,ownerUid:identity.uid,updatedAt:db.serverTimestamp()});
    },
    async save(payload,expectedRevision) {
      const archive=db.doc(db.collection(ref,'history'));
      return db.runTransaction(firestore,async transaction=>{
        const snapshot=await transaction.get(ref);
        const previous=snapshot.exists()?snapshot.data():{revision:0,payload:seed};
        if(previous.revision!==expectedRevision)throw new RevisionConflict();
        const revision=previous.revision+1;
        transaction.set(archive,{revision:previous.revision,payload:previous.payload,savedAt:db.serverTimestamp(),savedBy:identity.uid});
        transaction.set(ref,{schema:1,revision,payload,updatedAt:db.serverTimestamp(),updatedBy:identity.uid,backupId:archive.id});
        transaction.delete(draft);
        return revision;
      });
    },
    async history() {
      const snapshot=await db.getDocsFromServer(db.query(db.collection(ref,'history'),db.orderBy('revision','desc'),db.limit(10)));
      return snapshot.docs.map(d=>({id:d.id,...d.data()}));
    }
  };
}
