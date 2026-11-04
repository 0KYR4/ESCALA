/* ESCALA – comentários compartilhados via Firestore, sem alterar o Gantt nem o Trello. */
const esc = {
  db: null, user: null, error: '', ready: false,
  api: null
};
const cfg = window.ESCALA_FIREBASE_CONFIG;
const authorKey = 'escala:comentarios:autor:v2';
const panels = new Set(), focusTargets = new Map();
const collName = 'escala_comments';

function element(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(text, cls='') {
  const b = element('button', 'esc-comment-btn '+cls, text);
  b.type = 'button';
  return b;
}
function taskLabel(t) { return t?.task ? t.stage+' · '+t.task : (t?.stage || 'Todo o serviço'); }
function dateLabel(d) {
  try { const dt = d?.toDate ? d.toDate() : new Date(d || Date.now()); return dt.toLocaleString('pt-BR'); }
  catch { return 'Agora'; }
}
function statusText() {
  return esc.ready ? 'Comentários compartilhados online · todos veem as atualizações'
    : esc.error ? 'Comentários indisponíveis: '+esc.error
    : 'Comentários online ainda não configurados no Firebase';
}
const css = document.createElement('style');
css.textContent = `
.esc-comment-panel{background:#f7fbfe;border:1px solid #bfd5e3;border-radius:12px;padding:14px;margin-top:12px;color:#183950}
.esc-comment-panel h3{font-size:14px;margin:0 0 5px}
.esc-comment-sub{font-size:11px;color:#557388;line-height:1.55;margin:4px 0 12px}
.esc-comment-fields{display:grid;grid-template-columns:190px 1fr;gap:9px;margin:8px 0}
.esc-comment-field label{display:block;font-size:11px;font-weight:750;color:#36566a;margin-bottom:4px}
.esc-comment-field input,.esc-comment-field select,.esc-comment-field textarea{font:inherit;width:100%;border:1px solid #b8d1de;border-radius:8px;background:#fff;color:#143752;color-scheme:light;padding:9px;font-size:12px}
.esc-comment-field textarea{min-height:88px;resize:vertical}
.esc-comment-btn{font:inherit;font-size:11px;font-weight:700;cursor:pointer;padding:8px 11px;border:1px solid #bdd1df;background:#fff;color:#20516c;border-radius:8px}
.esc-comment-btn:hover{background:#eaf4f9}.esc-comment-btn.primary{background:#167d73;color:#fff;border-color:#167d73}
.esc-comment-btn:disabled{cursor:not-allowed;opacity:.48}
.esc-comment-foot{border-top:1px solid #d9e5eb;margin-top:11px;padding-top:10px;display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.esc-comment-banner{background:#eaf8f4;border-left:4px solid #168478;border-radius:9px;padding:11px 14px;margin:6px 0 12px;font-size:12px;color:#175650}
.esc-comment-banner.offline{background:#fff2e7;border-left-color:#bd8140;color:#674f35}
.esc-comment-list{margin-top:10px;display:flex;flex-direction:column;gap:8px}
.esc-comment-note{border:1px solid #d4e1e9;background:#fff;border-radius:9px;padding:10px 12px}
.esc-comment-note-meta{font-size:11px;color:#5d7888;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.esc-comment-note-task{font-size:10px;color:#548071;font-weight:750;margin:5px 0}
.esc-comment-note-body{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}
.esc-comment-actions{display:flex;gap:5px}
.esc-comment-actions .esc-comment-btn{padding:4px 7px;font-size:10px}
.esc-comment-plus{border:1px solid #bad9cf;background:#f0faf6;color:#16776c;border-radius:6px;margin-left:auto;min-width:25px;min-height:25px;cursor:pointer;font-weight:bold}
@media(max-width:740px){.esc-comment-fields{grid-template-columns:1fr}}
`;
document.head.appendChild(css);

function knownChoices(serviceId) {
  const svc = G[serviceId];
  const choices = [{target:{}, label:'Comentário geral sobre o serviço'}];
  (svc?.stages || []).forEach(st=>(st.tasks||[]).forEach(t=>{
    const task = typeof t==='string' ? t : t.name;
    choices.push({target:{stage:st.name,task}, label:st.name+' → '+task});
  }));
  return choices;
}
function makePanel(serviceId, initialTarget={}) {
  const pane = element('section','esc-comment-panel');
  const svc = G[serviceId];
  pane.append(element('h3','', 'Comentários · '+(svc?.name||serviceId)));
  pane.append(element('p','esc-comment-sub','Os comentários são públicos e aparecem para todas as pessoas que acessarem esta página. Não inclua dados confidenciais ou de clientes. O nome informado não é verificado. A Supervisão continua exclusiva do Gantt.'));
  const grid = element('div','esc-comment-fields');
  const authorWrap=element('div','esc-comment-field'), targetWrap=element('div','esc-comment-field');
  const authorLabel=element('label','', 'Seu nome'), targetLabel=element('label','', 'Sobre qual atividade?');
  const author=element('input');author.placeholder='Nome do integrante';author.maxLength=80;
  try {author.value=localStorage.getItem(authorKey)||'';} catch {}
  const target=element('select');
  const choices=knownChoices(serviceId);
  choices.forEach((c,i)=>{
    const o=element('option','',c.label);o.value=String(i);target.append(o);
    if(initialTarget.task===c.target.task&&initialTarget.stage===c.target.stage)target.value=String(i);
  });
  authorWrap.append(authorLabel,author);targetWrap.append(targetLabel,target);
  grid.append(authorWrap,targetWrap);
  const textWrap=element('div','esc-comment-field');
  const ta=element('textarea');ta.maxLength=2000;ta.placeholder='Escreva sua observação ou sugestão...';
  textWrap.append(element('label','', 'Comentário'),ta);
  const actions=element('div');actions.style.marginTop='10px';
  const save=button('Enviar comentário para todos','primary');
  save.disabled=!esc.ready;
  const feedback=element('span','esc-comment-sub',esc.ready?'':'Firebase não está conectado. O envio ficará disponível quando a configuração for concluída.');
  actions.append(save,feedback);
  const list=element('div','esc-comment-list');
  pane.append(grid,textWrap,actions,list);
  let stop=null;
  async function submit(){
    const name=author.value.trim(), text=ta.value.trim();
    if(!name){author.focus();return;}
    if(!text){ta.focus();return;}
    if(!esc.ready){feedback.textContent=statusText();return;}
    save.disabled=true;feedback.textContent='Enviando para todos...';
    try {
      try{localStorage.setItem(authorKey,name);}catch{}
      await esc.api.addDoc(esc.api.collection(esc.db,collName),{
        serviceId, stage:choices[Number(target.value)]?.target.stage||'',
        task:choices[Number(target.value)]?.target.task||'',
        author:name,text,ownerUid:esc.user.uid,
        createdAt:esc.api.serverTimestamp(),updatedAt:esc.api.serverTimestamp()
      });
      ta.value='';feedback.textContent='Comentário publicado e visível para todos.';
    } catch(e) { feedback.textContent='Não foi possível enviar: '+(e?.message||'verifique a conexão'); }
    finally {save.disabled=!esc.ready;}
  }
  save.onclick=submit;
  const renderList=arr=>{
    list.replaceChildren();
    if(!arr.length){list.append(element('p','esc-comment-sub','Nenhum comentário publicado neste serviço.'));return;}
    const ordered=arr.slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    ordered.forEach(note=>{
      const tile=element('article','esc-comment-note');
      const meta=element('div','esc-comment-note-meta');
      meta.append(element('span','',(note.author||'Sem nome')+' · '+dateLabel(note.createdAt)));
      if(note.ownerUid===esc.user?.uid){
        const ctr=element('span','esc-comment-actions');
        const edit=button('Editar'),del=button('Excluir');
        edit.onclick=async()=>{
          const updated=prompt('Editar comentário:',note.text);
          if(updated===null)return;
          if(!updated.trim()||updated.trim().length>2000){alert('O comentário precisa ter entre 1 e 2000 caracteres.');return;}
          try {await esc.api.updateDoc(esc.api.doc(esc.db,collName,note.id),{text:updated.trim(),updatedAt:esc.api.serverTimestamp()});}
          catch(e){alert('Erro ao editar: '+e.message);}
        };
        del.onclick=async()=>{
          if(!confirm('Excluir este comentário online para todos?'))return;
          try {await esc.api.deleteDoc(esc.api.doc(esc.db,collName,note.id));}
          catch(e){alert('Erro ao excluir: '+e.message);}
        };
        ctr.append(edit,del);meta.append(ctr);
      }
      tile.append(meta,element('div','esc-comment-note-task',taskLabel(note)),element('div','esc-comment-note-body',note.text));
      list.append(tile);
    });
  };
  if(esc.ready){
    list.append(element('p','esc-comment-sub','Carregando comentários online...'));
    const q=esc.api.query(esc.api.collection(esc.db,collName),esc.api.where('serviceId','==',serviceId));
    stop=esc.api.onSnapshot(q,snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()}));
      renderList(data);
    },err=>{list.replaceChildren(element('p','esc-comment-sub','Falha ao ler comentários: '+err.message));});
    const observer=new MutationObserver(()=>{
      if(pane.isConnected)return;
      if(stop)stop();observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  } else list.append(element('p','esc-comment-sub',statusText()));
  return pane;
}
function addFeatures(){
  const previousPair=makePair,previousStage=renderStage,previousDetail=detailGeneric,previousMap=renderMap;
  makePair=function(m,i){
    const el=previousPair(m,i),serviceId=m.g;
    const foot=element('div','esc-comment-foot');
    const toggle=button('Comentários compartilhados');
    toggle.onclick=()=>{
      const opened=!panels.has(i);
      if(opened){panels.add(i);expandedPairs.add(i);}else panels.delete(i);
      const old=document.getElementById('map-pair-'+i);
      old?.replaceWith(makePair(DATA.mapping[i],i));
      if(opened)document.querySelector('#map-pair-'+i+' .esc-comment-panel textarea')?.focus({preventScroll:true});
    };
    foot.append(toggle);
    if(panels.has(i))foot.append(makePanel(serviceId,focusTargets.get(i)||{}));
    el.append(foot);return el;
  };
  renderStage=function(st,trello=false){
    const el=previousStage(st,trello);
    (st.tasks||[]).forEach((t,j)=>{
      const row=el.querySelectorAll('.stage-task')[j];if(!row)return;
      const b=button('+','esc-comment-plus');b.title='Comentar esta atividade';
      b.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        const pair=b.closest('.map-pair');if(!pair)return;
        const i=Number(pair.id.replace('map-pair-',''));
        focusTargets.set(i,{stage:st.name,task:typeof t==='string'?t:t.name});
        panels.add(i);expandedPairs.add(i);
        pair.replaceWith(makePair(DATA.mapping[i],i));
        document.querySelector('#map-pair-'+i+' .esc-comment-panel textarea')?.focus({preventScroll:true});
      };
      row.append(b);
    });return el;
  };
  detailGeneric=function(a,type){
    previousDetail(a,type);
    if(type==='concess')return;
    const area=element('div');area.style.marginTop='12px';
    const b=button('Comentários compartilhados');
    let showing=false;
    b.onclick=()=>{showing=!showing;area.replaceChildren(b);if(showing)area.append(makePanel(a.id));};
    area.append(b);document.getElementById('details')?.append(area);
  };
  renderMap=function(){
    previousMap();
    const banner=element('section','esc-comment-banner'+(esc.ready?'':' offline'),statusText());
    const body=document.getElementById('mapBody');
    body?.insertBefore(banner,body.querySelector('.legend-explainer')||body.firstChild);
  };
  if(mode===2)renderMap();
  else {
    const aside=document.querySelector('aside.left');
    const notice=element('p','esc-comment-sub',statusText());
    aside?.append(notice);
    if(selection)select(selection.id,selection.type);
  }
}
async function init(){
  if(!cfg || !cfg.projectId || !cfg.apiKey){esc.error='projeto Firebase ainda não configurado';if(mode===2)renderMap();return;}
  try{
    const version='12.5.0';
    const [app,auth,fire]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/'+version+'/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/'+version+'/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/'+version+'/firebase-firestore.js')
    ]);
    const appInstance=app.initializeApp(cfg);
    const cred=await auth.signInAnonymously(auth.getAuth(appInstance));
    esc.db=fire.getFirestore(appInstance);esc.user=cred.user;esc.api=fire;esc.ready=true;
    if(mode===2)renderMap();
  }catch(e){esc.error=e.message||'erro de inicialização';if(mode===2)renderMap();}
}
init().finally(addFeatures);
