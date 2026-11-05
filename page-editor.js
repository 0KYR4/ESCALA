import {clone,fromData,normalize,applyToData,newPair,newStage,newTask,move,moveTask} from './editor-model.mjs';
const key='escala:editor:local:v1';
let model=fromData(DATA), editing=false, history=[], undo=[], redo=[], dragging=null;
let storageWarning='';
try{const local=JSON.parse(localStorage.getItem(key));if(local){model=normalize(local.model);history=(local.history||[]).slice(-10).map(normalize);}}catch{storageWarning='Não foi possível recuperar o rascunho local.';}
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const launch=el('button','editor-launch','Editar nos cards');launch.type='button';document.querySelector('header').append(launch);
const status=el('span','inline-status',storageWarning||'Alterações salvas só neste navegador.');status.setAttribute('role','status');
function button(parent,label,fn,cls=''){const b=el('button','inline-action '+cls,label);b.type='button';b.onclick=e=>{e.stopPropagation();fn();};parent.append(b);return b;}
function persist(){try{localStorage.setItem(key,JSON.stringify({model,history}));status.textContent='Rascunho salvo neste navegador.';}catch{status.textContent='Não foi possível salvar. Exporte uma cópia antes de sair.';}}
function sync(){applyToData(model,DATA,G,T);}
function refresh(){const y=$('viewport').scrollTop;sync();renderMap();nav();$('viewport').scrollTop=y;}
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
[...group.querySelectorAll('.stage-task')].forEach((row,ti)=>{const task=stage.tasks[ti],txt=row.querySelector('.stage-task-text');const chip=txt.querySelector('.stage-status');const text=el('span');text.dataset.editRef=task.id;text.textContent=task.name;txt.replaceChildren(text);if(chip)txt.append(chip);if(mirrored)return;
 editable(text,task.name,'Atividade',500,(m,v)=>{pairIn(m,pair.id)[side].stages[index].tasks[ti].name=v;});
 const tools=el('div','inline-tools task-tools');row.append(tools);
 button(tools,'↑',()=>change(m=>move(pairIn(m,pair.id)[side].stages[index].tasks,ti,-1))).setAttribute('aria-label','Subir atividade');
 button(tools,'↓',()=>change(m=>move(pairIn(m,pair.id)[side].stages[index].tasks,ti,1))).setAttribute('aria-label','Descer atividade');
 button(tools,'Mover',()=>{if(tools.querySelector('select'))return;const dest=el('select','inline-destination');dest.setAttribute('aria-label','Destino da atividade');dest.append(el('option','','Escolha o destino…'));model.pairs.forEach(p=>{for(const s of ['gantt','trello'])p[s].stages.forEach(target=>{if(target.id===stage.id||s==='trello'&&target.supervision||stage.supervision&&(!target.supervision||s!=='gantt'))return;const o=el('option','',p[s].name+' · '+s+' · '+target.name);o.value=JSON.stringify({pairId:p.id,side:s,stageId:target.id});dest.append(o);});});dest.onchange=()=>{if(dest.value)change(m=>moveTask(m,{pairId:pair.id,side,stageId:stage.id,taskId:task.id},JSON.parse(dest.value)));};tools.append(dest);dest.focus();});
 remove(tools,()=>change(m=>pairIn(m,pair.id)[side].stages[index].tasks.splice(ti,1)));
 const handle=el('button','inline-drag','⠿');handle.type='button';handle.draggable=true;handle.setAttribute('aria-label','Arrastar atividade');handle.ondragstart=e=>{dragging={pairId:pair.id,side,stageId:stage.id,taskId:task.id};e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move';};handle.ondragend=()=>{dragging=null;document.querySelectorAll('.drop-target').forEach(n=>n.classList.remove('drop-target'));};row.prepend(handle);
 row.ondragover=e=>{if(dragging){e.preventDefault();e.stopPropagation();row.classList.add('drop-target');}};row.ondragleave=()=>row.classList.remove('drop-target');row.ondrop=e=>{e.preventDefault();e.stopPropagation();if(dragging)change(m=>moveTask(m,dragging,{pairId:pair.id,side,stageId:stage.id},task.id));dragging=null;};
});
if(!mirrored){button(group,'＋ Atividade',()=>change(m=>pairIn(m,pair.id)[side].stages[index].tasks.push(newTask())),'add-inline');group.ondragover=e=>{if(dragging)e.preventDefault();};group.ondrop=e=>{e.preventDefault();if(dragging)change(m=>moveTask(m,dragging,{pairId:pair.id,side,stageId:stage.id}));dragging=null;};}return group;};
const originalPair=makePair;
makePair=function(mapping,i){const section=originalPair(mapping,i);if(!editing)return section;const pair=model.pairs[i];
section.querySelectorAll('.map-card-head').forEach((head,j)=>{const side=j?'trello':'gantt';const card=el('div',head.className);card.append(...head.childNodes);head.replaceWith(card);const title=card.querySelector('.map-title');title.dataset.editRef=side+'-'+pair.id;editable(title,pair[side].name,'Título do card '+(j?'Trello':'Gantt'),160,(m,v)=>{pairIn(m,pair.id)[side].name=v;});card.querySelector('.map-hint')?.remove();button(card,expandedPairs.has(i)?'Recolher':'Ver atividades',()=>expandPair(i,!expandedPairs.has(i)));});
if(expandedPairs.has(i)){
 const details=section.querySelector('.pair-details');for(const side of ['gantt','trello']){const footer=el('div','inline-card-footer '+side);button(footer,'＋ Etapa',()=>change(m=>pairIn(m,pair.id)[side].stages.push(newStage())));details.append(footer);if(side==='gantt')details.append(el('div','stage-connector',''));}
}
const tools=el('div','inline-pair-tools');section.prepend(tools);button(tools,'↑',()=>change(m=>move(m.pairs,i,-1))).setAttribute('aria-label','Subir par de cards');button(tools,'↓',()=>change(m=>move(m.pairs,i,1))).setAttribute('aria-label','Descer par de cards');remove(tools,()=>change(m=>m.pairs.splice(i,1)));return section;};
function exportDraft(){const url=URL.createObjectURL(new Blob([JSON.stringify(model,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='escala-rascunho.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const originalMap=renderMap;
renderMap=function(){originalMap();if(!editing)return;const bar=el('div','inline-editor-bar');bar.append(el('strong','','Clique no texto do card para editar.'),status);button(bar,'Concluir edição',finish,'primary');button(bar,'Desfazer',()=>{if(!undo.length)return;redo.push(clone(model));model=undo.pop();persist();refresh();},'undo-action').disabled=!undo.length;button(bar,'Refazer',()=>{if(!redo.length)return;undo.push(clone(model));model=redo.pop();persist();refresh();},'redo-action').disabled=!redo.length;button(bar,'＋ Card',()=>{change(m=>m.pairs.push(newPair()));$('map-pair-'+(model.pairs.length-1))?.scrollIntoView({block:'center'});});button(bar,'Exportar',exportDraft);$('mapBody').prepend(bar);};
function finish(){history=[...history,clone(model)].slice(-10);persist();editing=false;document.body.classList.remove('editing-cards');launch.textContent='Editar nos cards';refresh();}
launch.onclick=()=>{if(editing){finish();return;}const open=mode===2?[...expandedPairs]:[0];editing=true;document.body.classList.add('editing-cards');launch.textContent='Concluir edição';sync();setMode(2);(open.length?open:[0]).forEach(i=>{if(i<model.pairs.length)expandedPairs.add(i);});refresh();};
const originalMode=setMode;
setMode=function(k){if(editing&&k!==2)finish();originalMode(k);};
