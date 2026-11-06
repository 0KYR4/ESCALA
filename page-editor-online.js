import {clone,fromData,normalize,applyToData,newPair,newStage,newTask,move,moveTask} from './editor-model.mjs?v=20261105-2';
import {connectEditor,serializeModel} from './editor-cloud.mjs?v=20261105-2';
import {createDraftAutosave} from './editor-autosave.mjs';
import {compareModels} from './editor-compare.mjs';
const board=window.ESCALA_EDITOR_BOARD||'main';
const key=board==='main'?'escala:editor:local:v1':'escala:editor:'+board+':v1';
let model=fromData(DATA), editing=true, history=[], undo=[], redo=[], dragging=null;
const seed=serializeModel(model,normalize);
let cloud=null,loaded=false,saving=false,dirty=false,baseRevision=null,latest=null,syncedPayload=seed,conflict=false,serial=0,cloudError='';
let storageWarning='';
let draftAutosave=null,draftState='waiting',draftError='';
try{const local=JSON.parse(localStorage.getItem(key));if(local){model=normalize(local.model);history=(local.history||[]).slice(-10).map(normalize);dirty=local.dirty??serializeModel(model,normalize)!==seed;baseRevision=Number.isInteger(local.baseRevision)?local.baseRevision:null;}}catch{storageWarning='Não foi possível recuperar o rascunho local.';}
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const status=el('span','inline-status',storageWarning||'Conectando ao salvamento online…');status.setAttribute('role','status');
function button(parent,label,fn,cls=''){const b=el('button','inline-action '+cls,label);b.type='button';b.onclick=e=>{e.stopPropagation();fn();};parent.append(b);return b;}
function persist(mark=true){if(mark){serial++;dirty=serializeModel(model,normalize)!==syncedPayload;}try{localStorage.setItem(key,JSON.stringify({model,history,dirty,baseRevision}));storageWarning='';}catch{storageWarning='O rascunho não coube neste navegador. Exporte uma cópia.';}if(mark)draftAutosave?.queue({payload:serializeModel(model,normalize),baseRevision:baseRevision??0});cloudStatus();}
function sync(){applyToData(model,DATA,G,T);}
function refresh(){const y=$('viewport').scrollTop;sync();if(mode===2){renderMap();nav();$('viewport').scrollTop=y;}else{const selected=selection;tree();nav();fit();if(selected&&(selected.type==='gantt'?G[selected.id]:selected.type==='trello'?T[selected.id]:null))select(selected.id,selected.type);}}
function change(fn,redraw=true){try{const next=clone(model);fn(next);const valid=normalize(next);undo.push(clone(model));undo=undo.slice(-30);redo=[];model=valid;persist();if(redraw)refresh();else{sync();nav();const u=document.querySelector('.undo-action'),r=document.querySelector('.redo-action');if(u)u.disabled=!undo.length;if(r)r.disabled=!redo.length;}}catch(e){status.textContent=e.message;return false;}return true;}
function remove(parent,fn){button(parent,'Excluir',()=>{if(parent.querySelector('.inline-confirm'))return;const row=el('span','inline-confirm','Excluir? ');button(row,'Sim, excluir',fn);button(row,'Cancelar',()=>row.remove());parent.append(row);},'delete');}
function editable(node,value,label,max,update){node.replaceChildren(document.createTextNode(value));node.contentEditable='plaintext-only';node.setAttribute('role','textbox');node.setAttribute('aria-label',label);node.setAttribute('aria-multiline','false');node.classList.add('inline-text');node.spellcheck=true;
 node.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();node.blur();}if(e.key==='Escape'){e.preventDefault();node.textContent=value;node.blur();}e.stopPropagation();};node.onclick=e=>e.stopPropagation();
 node.onblur=()=>{const text=node.textContent.trim();if(text===value)return;if(text.length>max||!text){status.textContent=`Use de 1 a ${max} caracteres.`;node.textContent=value;return;}if(change(m=>update(m,text),false)){value=text;node.textContent=text; // Atualiza também os espelhos já visíveis sem interromper o cursor nos outros cards.
 document.querySelectorAll('[data-edit-ref]').forEach(other=>{if(other!==node&&other.dataset.editRef===node.dataset.editRef)other.textContent=text;});
 }else node.textContent=value;};return node;}
function pairIn(m,id){return m.pairs.find(p=>p.id===id);}
function locate(stageId,side){for(const pair of model.pairs){const index=pair[side].stages.findIndex(s=>s.id===stageId);if(index>=0)return {pair,index,stage:pair[side].stages[index]};}}
const originalStage=renderStage;
renderStage=function(st,trello=false){const group=originalStage(st,trello);if(!editing)return group;const side=trello?'trello':'gantt',found=locate(st.id,side);if(!found)return group;const {pair,index,stage}=found;const mirrored=trello&&stage.supervision;
const refStage=mirrored?stage.id.replace(/^mirror-/,''):stage.id;
const name=group.querySelector('.stage-name > span');name.dataset.editRef=refStage;
if(mirrored){name.textContent=stage.name+' · SOMENTE CONSULTA';}else{
 editable(name,stage.name,'Nome da etapa',120,(m,v)=>{const s=pairIn(m,pair.id)[side].stages[index];s.name=v;s.supervision=v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()==='supervisao';});
 const tools=el('div','inline-tools');group.querySelector('.stage-name').append(tools);
 button(tools,'↑',()=>change(m=>move(pairIn(m,pair.id)[side].stages,index,-1))).setAttribute('aria-label','Subir etapa');
 button(tools,'↓',()=>change(m=>move(pairIn(m,pair.id)[side].stages,index,1))).setAttribute('aria-label','Descer etapa');
 remove(tools,()=>change(m=>pairIn(m,pair.id)[side].stages.splice(index,1)));
}
[...group.querySelectorAll('.stage-task')].forEach((row,ti)=>{const task=stage.tasks[ti],txt=row.querySelector('.stage-task-text');const chip=txt.querySelector('.stage-status');const text=el('span');text.dataset.editRef=task.id;text.textContent=task.name;txt.replaceChildren(text);if(chip)txt.append(chip);if(mirrored){if(task.tags){chip?.remove();const tags=el('div','task-tags');for(const label of task.tags)tags.append(el('span','stage-status',label));txt.append(tags);}return;}
 chip?.remove();const labels=task.tags|| (task.status?[task.status]:[]);const tagList=el('div','task-tags');txt.append(tagList);
 const setLabels=(m,values)=>{const target=pairIn(m,pair.id)[side].stages[index].tasks[ti];target.tags=values;target.status=values[0]||'';};
 function tagEditor(tagIndex){if(row.querySelector('.tag-editor'))return;const trigger=tagIndex===null?tagList.querySelector('.tag-add'):tagList.querySelectorAll('.tag-label')[tagIndex];const anchor=tagIndex===null?trigger:trigger?.parentElement;const input=el('input','tag-editor tag-editor-single');input.type='text';input.maxLength=120;input.value=tagIndex===null?'':labels[tagIndex];input.placeholder='Escolher ou digitar etiqueta';input.setAttribute('aria-label','Texto da etiqueta');input.title='Escolha uma etiqueta ou digite · Enter salva · Esc cancela';
 const suggestions=el('datalist');suggestions.id='tag-options-'+task.id;const known=new Set(['Já no Trello original','Encontrado no Gantt','Incluído no Gantt V2','Sugestão de atividade','Somente se aplicável']);for(const p of model.pairs)for(const s of ['gantt','trello'])for(const st of p[s].stages)for(const t of st.tasks)for(const label of t.tags||(t.status?[t.status]:[]))known.add(label);for(const label of known){const option=el('option');option.value=label;suggestions.append(option);}tagList.querySelector('datalist')?.remove();tagList.append(suggestions);input.setAttribute('list',suggestions.id);
 const close=()=>{input.remove();if(anchor)anchor.hidden=false;};const save=()=>{const value=input.value.trim();if(!value){close();return;}if(tagIndex!==null&&value===labels[tagIndex]){close();return;}change(m=>{const values=[...labels];if(tagIndex===null)values.push(value);else values[tagIndex]=value;setLabels(m,values);});};input.onblur=save;input.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();input.blur();}if(e.key==='Escape'){input.onblur=null;close();}};if(anchor){anchor.before(input);anchor.hidden=true;}else tagList.append(input);input.focus();}
 labels.forEach((label,labelIndex)=>{const tag=el('span','stage-status',undefined);const edit=button(tag,label,()=>tagEditor(labelIndex),'tag-label');edit.title='Editar etiqueta';const clear=button(tag,'×',()=>change(m=>setLabels(m,labels.filter((_,i)=>i!==labelIndex))),'tag-remove');clear.setAttribute('aria-label','Remover etiqueta '+label);clear.title='Remover etiqueta';tagList.append(tag);});
 button(tagList,'+ Etiqueta',()=>tagEditor(null),'tag-add');
 editable(text,task.name,'Atividade',500,(m,v)=>{pairIn(m,pair.id)[side].stages[index].tasks[ti].name=v;});
 const tools=el('div','inline-tools task-tools');row.append(tools);
 button(tools,'↑',()=>change(m=>move(pairIn(m,pair.id)[side].stages[index].tasks,ti,-1))).setAttribute('aria-label','Subir atividade');
 button(tools,'↓',()=>change(m=>move(pairIn(m,pair.id)[side].stages[index].tasks,ti,1))).setAttribute('aria-label','Descer atividade');
 button(tools,'Mover',()=>{if(tools.querySelector('select'))return;const dest=el('select','inline-destination');dest.setAttribute('aria-label','Destino da atividade');dest.append(el('option','','Escolha o destino…'));model.pairs.forEach(p=>{for(const s of ['gantt','trello'])p[s].stages.forEach(target=>{if(target.id===stage.id||s==='trello'&&target.supervision||stage.supervision&&(!target.supervision||s!=='gantt'))return;const o=el('option','',p[s].name+' · '+s+' · '+target.name);o.value=JSON.stringify({pairId:p.id,side:s,stageId:target.id});dest.append(o);});});dest.onchange=()=>{if(dest.value)change(m=>moveTask(m,{pairId:pair.id,side,stageId:stage.id,taskId:task.id},JSON.parse(dest.value)));};tools.append(dest);dest.focus();});
 remove(tools,()=>change(m=>pairIn(m,pair.id)[side].stages[index].tasks.splice(ti,1)));
 const handle=el('button','inline-drag','⠿');handle.type='button';handle.draggable=true;handle.setAttribute('aria-label','Arrastar atividade');handle.ondragstart=e=>{dragging={pairId:pair.id,side,stageId:stage.id,taskId:task.id};e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move';};handle.ondragend=()=>{dragging=null;document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));};row.prepend(handle);
 row.ondragover=e=>{if(dragging){e.preventDefault();e.stopPropagation();row.classList.add('drop-target');}};row.ondragleave=()=>row.classList.remove('drop-target');row.ondrop=e=>{e.preventDefault();e.stopPropagation();if(dragging)change(m=>moveTask(m,dragging,{pairId:pair.id,side,stageId:stage.id},task.id));dragging=null;};
});
if(!mirrored){button(group,'Adicionar atividade',()=>change(m=>pairIn(m,pair.id)[side].stages[index].tasks.push(newTask())),'add-inline');group.ondragover=e=>{if(dragging)e.preventDefault();};group.ondrop=e=>{e.preventDefault();if(dragging)change(m=>moveTask(m,dragging,{pairId:pair.id,side,stageId:stage.id}));dragging=null;};}return group;};
const originalPair=makePair;
makePair=function(mapping,i){const section=originalPair(mapping,i);if(!editing)return section;const pair=model.pairs[i];
section.querySelectorAll('.map-card-head').forEach((head,j)=>{const side=j?'trello':'gantt';const card=el('div',head.className);card.append(...head.childNodes);head.replaceWith(card);const title=card.querySelector('.map-title');title.dataset.editRef=side+'-'+pair.id;editable(title,pair[side].name,'Título do card '+(j?'Trello':'Gantt'),160,(m,v)=>{pairIn(m,pair.id)[side].name=v;});card.querySelector('.map-hint')?.remove();
const paint=color=>{card.style.backgroundColor=color+'18';card.style.borderColor=color+'80';card.style.borderTop='5px solid '+color;};
if(pair[side].color)paint(pair[side].color);
const colors=el('div','card-color-control color-palette');colors.setAttribute('role','group');colors.setAttribute('aria-label','Cor do card '+(j?'Trello':'Gantt'));
const palette=[['Azul','#6293c5'],['Verde','#49aa94'],['Amarelo','#d4ad36'],['Laranja','#db8b42'],['Vermelho','#ce6666'],['Roxo','#9876bc'],['Rosa','#cf80ab'],['Cinza','#87939f']];
const currentColor=(pair[side].color||(j?'#49aa94':'#6293c5')).toLowerCase();
if(!palette.some(([,value])=>value===currentColor))palette.unshift(['Cor atual',currentColor]);
const swatches=el('div','color-options');swatches.hidden=true;
const toggle=button(colors,'',()=>{swatches.hidden=!swatches.hidden;toggle.setAttribute('aria-expanded',String(!swatches.hidden));},'color-dot color-toggle');toggle.style.setProperty('--swatch',currentColor);toggle.title='Escolher cor';toggle.setAttribute('aria-label','Escolher cor do card '+(j?'Trello':'Gantt'));toggle.setAttribute('aria-expanded','false');
for(const [name,value] of palette){const dot=button(swatches,'',()=>{if(change(m=>{pairIn(m,pair.id)[side].color=value;},false)){paint(value);toggle.style.setProperty('--swatch',value);swatches.querySelectorAll('.color-dot').forEach(choice=>choice.setAttribute('aria-pressed',String(choice===dot)));swatches.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}},'color-dot');dot.style.setProperty('--swatch',value);dot.title=name;dot.setAttribute('aria-label',name);dot.setAttribute('aria-pressed',String(value===currentColor));}
colors.append(swatches);colors.addEventListener('keydown',event=>{if(event.key==='Escape'){swatches.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}});colors.addEventListener('focusout',event=>{if(!colors.contains(event.relatedTarget)){swatches.hidden=true;toggle.setAttribute('aria-expanded','false');}});
card.append(colors);
button(card,expandedPairs.has(i)?'Recolher':'Ver atividades',()=>expandPair(i,!expandedPairs.has(i))).setAttribute('aria-expanded',String(expandedPairs.has(i)));});
if(expandedPairs.has(i)){
 const details=section.querySelector('.pair-details');for(const side of ['gantt','trello']){const footer=el('div','inline-card-footer '+side);button(footer,'Adicionar etapa',()=>{
 const existing=footer.querySelector('.stage-type-menu');if(existing){existing.remove();return;}
 const menu=el('div','stage-type-menu');menu.setAttribute('role','group');menu.setAttribute('aria-label','Escolher tipo de etapa');
 for(const name of ['Organização','Produção','Supervisão','Revisão','Entrega','Outra etapa']){
 const sup=name==='Supervisão',target=sup?'gantt':side;
 const choice=button(menu,name,()=>{if(change(m=>pairIn(m,pair.id)[target].stages.push(newStage(name==='Outra etapa'?'Nova etapa':name)))){const stages=$('map-pair-'+i)?.querySelectorAll('.paired-'+target+' [aria-label="Nome da etapa"]');if(name==='Outra etapa')stages?.[stages.length-1]?.focus();}});
 if(sup&&pair.gantt.stages.some(s=>s.supervision)){choice.disabled=true;choice.title='Este card já possui Supervisão.';}
 }
 button(menu,'Cancelar',()=>menu.remove());footer.append(menu);
});details.append(footer);if(side==='gantt')details.append(el('div','stage-connector',''));}
}
const tools=el('div','inline-pair-tools');section.prepend(tools);
const kinds=[['principal','Principal'],['especializado','Especializado'],['concessionaria','Concessionária']];const kindLabel=el('div','stage-kind-label');kindLabel.append(el('span','stage-kind-caption','Tipo de etapa'));const kindMenu=el('div','kind-popup');kindMenu.hidden=true;kindMenu.setAttribute('role','group');kindMenu.setAttribute('aria-label','Escolher tipo de etapa');
const closeKind=()=>{kindMenu.hidden=true;kind.setAttribute('aria-expanded','false');};const kind=button(kindLabel,kinds.find(([value])=>value===pair.kind)[1],()=>{kindMenu.hidden=!kindMenu.hidden;kind.setAttribute('aria-expanded',String(!kindMenu.hidden));},'card-kind');kind.dataset.kind=pair.kind;kind.setAttribute('aria-expanded','false');kind.setAttribute('aria-label','Tipo de etapa');
for(const [value,label] of kinds){const option=button(kindMenu,label,()=>change(m=>{pairIn(m,pair.id).kind=value;}),'kind-option');option.dataset.kind=value;option.setAttribute('aria-pressed',String(pair.kind===value));}kindLabel.append(kindMenu);kindLabel.addEventListener('focusout',event=>{if(!kindLabel.contains(event.relatedTarget))closeKind();});kindLabel.addEventListener('keydown',event=>{if(event.key==='Escape'){closeKind();kind.focus();}});tools.append(kindLabel);
button(tools,'↑',()=>change(m=>move(m.pairs,i,-1))).setAttribute('aria-label','Subir par de cards');button(tools,'↓',()=>change(m=>move(m.pairs,i,1))).setAttribute('aria-label','Descer par de cards');remove(tools,()=>change(m=>m.pairs.splice(i,1)));button(tools,'Novo cartão abaixo',()=>addCard(i+1));return section;};
function exportDraft(){const url=URL.createObjectURL(new Blob([JSON.stringify(model,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='escala-rascunho.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function addCard(index=model.pairs.length){
 const open=[...expandedPairs];
 if(!change(m=>m.pairs.splice(index,0,newPair()),false))return;
 expandedPairs.clear();open.forEach(i=>expandedPairs.add(i>=index?i+1:i));expandedPairs.add(index);$('q').value='';refresh();
 const card=$('map-pair-'+index);card?.scrollIntoView({block:'center',behavior:'smooth'});
 const title=card?.querySelector('[aria-label="Título do card Gantt"]');if(title){title.focus({preventScroll:true});const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(title);selection.removeAllRanges();selection.addRange(range);}
}
function cloudStatus(){
 document.querySelectorAll('.local-autosave').forEach(node=>{node.textContent=storageWarning||({waiting:'Rascunho automático · conectando',pending:'Rascunho · alterações aguardando',saving:'Salvando rascunho no servidor…',saved:'Rascunho salvo no servidor',ready:'Rascunho automático · servidor',error:'Rascunho só local · falha no servidor'})[draftState];node.classList.toggle('save-warning',!!storageWarning||draftState==='error');node.title=draftError||'Rascunho separado da versão pública. Salvar para todos publica a versão compartilhada.';});
 status.textContent=storageWarning||cloudError||(saving?'Salvando online…':conflict?'Outra versão foi publicada. Seu rascunho foi preservado.':!loaded?'Conectando ao salvamento online…':dirty?'Rascunho neste navegador · clique em Salvar para todos.':baseRevision===0?'Estrutura inicial · clique em Salvar para todos para publicá-la.':'Salvo online · versão '+baseRevision+' · todos veem esta estrutura.');
 document.querySelectorAll('.cloud-save').forEach(b=>b.disabled=!loaded||!cloud||saving||conflict||!dirty&&baseRevision!==0);
 document.querySelectorAll('.cloud-latest').forEach(b=>b.hidden=!conflict);
 document.querySelectorAll('.cloud-retry').forEach(b=>b.hidden=!cloudError&&draftState!=='error');
}
function receiveVersion(version){
 latest=version;
 if(!Number.isInteger(version.revision)||version.revision<0){cloudError='Versão online inválida. Use o histórico para recuperar.';cloudStatus();return;}
 if(saving)return;
 if(document.activeElement?.isContentEditable)document.activeElement.blur();
 let online;
 try{online=normalize(JSON.parse(version.payload));}catch{loaded=true;baseRevision=version.revision;cloudError='A estrutura online é inválida. Seu conteúdo local foi preservado; use Histórico para restaurar.';cloudStatus();return;}
 const payload=serializeModel(online,normalize);
 loaded=true;cloudError='';
 if(version.revision===0&&baseRevision===null)baseRevision=0;
 if(dirty&&serializeModel(model,normalize)!==payload){
   conflict=baseRevision===null||version.revision!==baseRevision;
   if(!conflict)syncedPayload=payload;
   persist(false);return;
 }
 const changed=serializeModel(model,normalize)!==payload;
 model=online;syncedPayload=payload;baseRevision=version.revision;dirty=false;conflict=false;
 if(changed){undo=[];redo=[];refresh();}
 persist(false);
}
async function startCloud(){
 draftAutosave?.stop();draftAutosave=null;draftState='waiting';draftError='';
 if(cloud)cloud.stop();cloud=null;loaded=false;cloudError='';cloudStatus();
 try{
   cloud=await connectEditor({config:window.ESCALA_FIREBASE_CONFIG,board,seed,onVersion:receiveVersion,onError:error=>{cloudError='Não foi possível ler o Firebase: '+error.message;loaded=false;cloudStatus();}});
   try{
     const stored=await cloud.readDraft();
     const connection=cloud;draftAutosave=createDraftAutosave({write:value=>connection.saveDraft(value),onState:(state,error)=>{draftState=state;draftError=error?.message||'';cloudStatus();}});
     draftState='ready';
     if(stored){
       const restored=normalize(JSON.parse(stored.payload));
       draftAutosave.remember({payload:stored.payload,baseRevision:stored.baseRevision});
       if(!dirty&&stored.payload!==syncedPayload){model=restored;baseRevision=stored.baseRevision;dirty=true;conflict=!!latest&&latest.revision!==baseRevision;persist(false);refresh();}
       if(serializeModel(model,normalize)===stored.payload)draftState='saved';
     }
     if(dirty)draftAutosave.queue({payload:serializeModel(model,normalize),baseRevision:baseRevision??0});
   }catch(error){draftState='error';draftError=error.message;}
   cloudStatus();
 }catch(error){cloudError='Sem conexão online: '+error.message;cloudStatus();}
}
window.addEventListener('online',()=>{if(draftState==='error')startCloud();});
async function saveForEveryone(){
 document.activeElement?.blur();
 if(!cloud||!loaded||saving||conflict)return;
 let payload;try{payload=serializeModel(model,normalize);}catch(error){status.textContent=error.message;return;}
 const savedSerial=serial;saving=true;cloudError='';cloudStatus();
 try{
   draftAutosave?.stop();await draftAutosave?.settled();
   const revision=await cloud.save(payload,baseRevision);
   baseRevision=revision;syncedPayload=payload;
   dirty=serial!==savedSerial&&serializeModel(model,normalize)!==payload;
   conflict=false;
   if(latest?.revision>revision)conflict=dirty;
   persist(false);
 }catch(error){
   if(error.code==='revision-conflict'){conflict=true;cloudError=error.message;}
   else cloudError='Não foi salvo online: '+error.message+'. Seu rascunho continua neste navegador.';
 }finally{
   saving=false;
   if(latest&&latest.revision>baseRevision&&!dirty)receiveVersion(latest);
   cloudStatus();
   startCloud();
 }
}
function confirmInline(parent,message,action){
 parent.querySelector('.cloud-confirm')?.remove();
 const row=el('div','cloud-confirm',message+' ');
 button(row,'Confirmar',()=>{row.remove();action();},'primary');button(row,'Cancelar',()=>row.remove());parent.append(row);
}
async function showHistory(){
 document.activeElement?.blur();
 const existing=document.querySelector('.cloud-history');if(existing){existing.remove();return;}
 const panel=el('section','cloud-history');panel.setAttribute('aria-label','Histórico de versões');panel.append(el('h2','','Histórico de versões'));
 const message=el('p','','Carregando versões…');panel.append(message);document.querySelector('.inline-editor-bar').after(panel);
 button(panel,'Fechar histórico',()=>panel.remove());
 if(!cloud){message.textContent='Conecte o Firebase para consultar o histórico.';return;}
 try{
   const versions=await cloud.history();message.textContent=versions.length?'Restaurar abre a versão como rascunho. Use Salvar para todos para publicá-la.':'O histórico será criado no primeiro salvamento online.';
   versions.forEach(version=>{
     const row=el('div','cloud-history-row');const when=version.savedAt?.toDate?.().toLocaleString('pt-BR')||'';
     row.append(el('span','','Versão '+version.revision+' · '+when));
     const actions=el('div','history-actions');row.append(actions);
     button(actions,'Comparar com o atual',()=>{
       panel.querySelector('.history-comparison')?.remove();
       const comparison=el('section','history-comparison');comparison.setAttribute('aria-label','Comparação de versões');
       comparison.append(el('h3','','Versão '+version.revision+' → Atual'));
       comparison.append(el('p','comparison-note','O atual inclui seu rascunho. Esta comparação não salva nem restaura alterações.'));
       button(comparison,'Fechar comparação',()=>comparison.remove());
       try{
         const changes=compareModels(JSON.parse(version.payload),model);
         const labels={added:'Adicionado',removed:'Removido',changed:'Alterado'};
         comparison.append(el('p','comparison-summary',changes.length?Object.entries(labels).map(([key,label])=>label+': '+changes.filter(c=>c.action===key).length).join(' · '):'Nenhuma diferença entre as versões.'));
         const list=el('div','comparison-list');
         for(const change of changes){const item=el('article','comparison-item '+change.action);item.append(el('span','comparison-badge',labels[change.action]),el('strong','comparison-path',change.type+' · '+change.path));
           if(change.fields.length){const table=el('table','comparison-table');const head=el('tr');for(const name of ['Campo','Histórico','Atual'])head.append(el('th','',name));const thead=el('thead');thead.append(head);table.append(thead);const tbody=el('tbody');for(const field of change.fields){const line=el('tr');for(const value of [field.name,field.before||'—',field.after||'—'])line.append(el('td','',value));tbody.append(line);}table.append(tbody);item.append(table);}list.append(item);
         }comparison.append(list);
       }catch(error){comparison.append(el('p','','Não foi possível comparar: '+error.message));}
       row.after(comparison);
     });
     button(actions,'Restaurar versão '+version.revision,()=>confirmInline(panel,'Abrir a versão '+version.revision+' como rascunho?',()=>{
       try{
         const restored=normalize(JSON.parse(version.payload));undo.push(clone(model));redo=[];model=restored;
         if(latest){baseRevision=latest.revision;syncedPayload=latest.payload;}
         conflict=false;cloudError='';persist();refresh();
       }catch(error){message.textContent='Não foi possível restaurar: '+error.message;}
     }));panel.append(row);
   });
 }catch(error){message.textContent='Não foi possível carregar o histórico: '+error.message;}
}
function reviewConflict(){
 const bar=document.querySelector('.inline-editor-bar');bar.querySelector('.cloud-conflict-panel')?.remove();
 const panel=el('div','cloud-conflict-panel','Há uma versão online diferente. Exporte seu rascunho se quiser guardar uma cópia. ');
 button(panel,'Carregar versão online',()=>confirmInline(panel,'Descartar este rascunho e carregar a estrutura online?',()=>{
   if(!latest)return;try{normalize(JSON.parse(latest.payload));}catch{status.textContent='Versão online inválida. Use Histórico.';return;}
   dirty=false;conflict=false;cloudError='';receiveVersion(latest);panel.remove();
 }));
 button(panel,'Publicar meu rascunho',()=>confirmInline(panel,'Seu rascunho substituirá a estrutura online. A versão anterior ficará no histórico. Confirmar?',async()=>{
   if(!latest)return;baseRevision=latest.revision;syncedPayload=latest.payload;conflict=false;cloudError='';dirty=true;panel.remove();await saveForEveryone();
 }));button(panel,'Fechar',()=>panel.remove());bar.append(panel);
}
const originalMap=renderMap;
renderMap=function(){originalMap();if(!editing)return;const bar=el('div','inline-editor-bar');const localBadge=el('span','local-autosave','Rascunho automático · neste navegador');localBadge.setAttribute('role','status');localBadge.title='Suas alterações ficam guardadas neste navegador. Use Salvar para todos para compartilhar.';bar.append(localBadge,status);button(bar,'Salvar para todos',saveForEveryone,'primary cloud-save');button(bar,'Revisar atualização',reviewConflict,'cloud-latest');button(bar,'Reconectar',startCloud,'cloud-retry');button(bar,'Histórico',showHistory);button(bar,'Desfazer',()=>{if(!undo.length)return;redo.push(clone(model));model=undo.pop();persist();refresh();},'undo-action').disabled=!undo.length;button(bar,'Refazer',()=>{if(!redo.length)return;undo.push(clone(model));model=redo.pop();persist();refresh();},'redo-action').disabled=!redo.length;button(bar,'Novo cartão',()=>addCard(),'new-card-action');button(bar,'Exportar',exportDraft);$('mapBody').prepend(bar);cloudStatus();};
// Os cards já abrem editáveis; não há modo de edição para ativar.
document.body.classList.add('editing-cards');
sync();
setMode(2);
if(model.pairs.length)expandedPairs.add(0);
refresh();
startCloud();
window.addEventListener('pagehide',()=>document.activeElement?.blur());
document.addEventListener('visibilitychange',()=>{if(document.hidden)document.activeElement?.blur();});
