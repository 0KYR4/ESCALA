// Modelo de edição compartilhada. Supervisão no Trello é sempre derivada do Gantt.
export const clone = value => JSON.parse(JSON.stringify(value));
export const uid = () => 'n-' + globalThis.crypto.randomUUID();
export const isSupervision = stage => stage.supervision === true;
const kinds = ['principal', 'especializado', 'concessionaria'];
const supName = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'supervisao';
function str(value, max, label, empty = false) {
  if(typeof value !== 'string' || value.length > max || (!empty && !value.trim())) throw Error(`${label}: texto inválido (máximo ${max} caracteres).`);
  return value.trim();
}
function id(value) { if(typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value))throw Error('Identificador inválido.');return value; }
function list(value, max, label) { if(!Array.isArray(value)||value.length>max)throw Error(`${label}: limite de ${max} itens.`);return value; }
export function mirrorSupervision(pair) {
  const left = pair.gantt.stages.filter(isSupervision);
  pair.trello.stages = pair.trello.stages.filter(s=>!s.supervision && !supName(s.name));
  left.forEach(stage=>{
    const index=pair.gantt.stages.indexOf(stage);
    pair.trello.stages.splice(Math.min(index,pair.trello.stages.length),0,{...clone(stage),id:'mirror-'+stage.id});
  });
}
export function normalize(input) {
  if(input?.schema !== 1) throw Error('Formato de estrutura desconhecido.');
  const used = new Set();
  const cardIds = {gantt:new Set(),trello:new Set()};
  const unique = value => { const key=id(value);if(used.has(key))throw Error('Identificadores duplicados.');used.add(key);return key; };
  const pairs=list(input.pairs,100,'Cards').map(pair=>{
    const out={id:unique(pair.id),kind:kinds.includes(pair.kind)?pair.kind:'principal'};
    for(const side of ['gantt','trello']) {
      const card=pair[side];
      if(cardIds[side].has(card.id))throw Error('Identificadores de cards duplicados.');
      cardIds[side].add(card.id);
      out[side]={id:id(card.id),name:str(card.name,160,'Nome do card'),note:str(card.note||'',2000,'Descrição',true),stages:[]};
      if(card.color!==undefined){
        if(typeof card.color!=='string'||!/^#[0-9a-fA-F]{6}$/.test(card.color))throw Error('Cor do card inválida.');
        out[side].color=card.color.toLowerCase();
      }
      out[side].stages=list(card.stages,30,'Etapas').filter(s=>side==='gantt'||(!s.supervision&&!supName(s.name))).map(stage=>({
        id:unique(stage.id),name:stage.supervision||supName(stage.name)?'Supervisão':str(stage.name,120,'Nome da etapa'),
        supervision:stage.supervision===true||supName(stage.name),
        tasks:list(stage.tasks,150,'Atividades').map(task=>({id:unique(task.id),name:str(task.name,500,'Atividade'),status:str(task.status||'',120,'Etiqueta',true),...(task.tags?{tags:list(task.tags,10,'Etiquetas').map(tag=>str(tag,120,'Etiqueta'))}:{}),nota_origem:str(task.nota_origem||'',2000,'Origem',true)}))
      }));
    }
    if(out.gantt.stages.filter(isSupervision).length>1)throw Error('Cada card pode ter uma única etapa de Supervisão.');
    mirrorSupervision(out);return out;
  });
  const result={schema:1,pairs};
  if(JSON.stringify(result).length>550000)throw Error('A estrutura atingiu o limite de tamanho. Exporte uma cópia antes de continuar.');
  return result;
}
export function fromData(data) {
  const g=Object.fromEntries([...data.gantt,...Object.values(data.extra)].map(x=>[x.id,x]));
  const t=Object.fromEntries(data.trello.map(x=>[x.id,x]));
  function card(item,side) {
    return {id:item.id,name:item.name,...(item.color?{color:item.color}:{}),note:(item.observacoes||[]).join('\n'),stages:item.stages.map((stage,i)=>({
      id:`${side}-${item.id}-s${i}`,name:stage.name,supervision:supName(stage.name),tasks:stage.tasks.map((task,j)=>({
        id:`${side}-${item.id}-s${i}-t${j}`,name:typeof task==='string'?task:task.name,status:task.status||'',...(task.tags?{tags:clone(task.tags)}:{}),nota_origem:task.nota_origem||''
      }))
    }))};
  }
  return normalize({schema:1,pairs:data.mapping.map(m=>({id:'pair-'+m.g,kind:g[m.g].kind||'principal',gantt:card(g[m.g],'g'),trello:card(t[m.t],'t')}))});
}
export function applyToData(model,data,G,T) {
  const valid=normalize(model);
  data.gantt=[];data.extra={};data.trello=[];data.mapping=[];
  Object.keys(G).forEach(k=>delete G[k]);Object.keys(T).forEach(k=>delete T[k]);
  for(const pair of valid.pairs) {
    for(const side of ['gantt','trello']) {
      const item=clone(pair[side]);item.kind=pair.kind;item.observacoes=item.note?[item.note]:[];
      item.stages.forEach(stage=>{stage.controle=stage.supervision?(side==='gantt'?'Gantt exclusivo':'Somente consulta do Gantt'):(side==='gantt'?'Gantt V2':'Trello');});
      if(side==='gantt'){G[item.id]=item;if(pair.kind==='concessionaria')data.extra[item.id]=item;else data.gantt.push(item);}
      else{T[item.id]=item;data.trello.push(item);}
    }
    data.mapping.push({g:pair.gantt.id,t:pair.trello.id,type:'editavel'});
  }
}
export function newPair() {
  const key=uid();
  return {id:key,kind:'principal',gantt:{id:'g-'+key,name:'Novo serviço',note:'',stages:[]},trello:{id:'t-'+key,name:'Novo cartão',note:'',stages:[]}};
}
export function newStage(name='Nova etapa') { return {id:uid(),name,supervision:supName(name),tasks:[]}; }
export function newTask() { return {id:uid(),name:'Nova atividade',status:'Incluído no Gantt V2',nota_origem:''}; }
export function move(array,index,offset) { const destination=index+offset;if(destination<0||destination>=array.length)return;array.splice(destination,0,array.splice(index,1)[0]); }
export function findStage(model,where) {
  const pair=model.pairs.find(p=>p.id===where.pairId);if(!pair||!['gantt','trello'].includes(where.side))throw Error('Card não encontrado.');
  const stage=pair[where.side].stages.find(s=>s.id===where.stageId);if(!stage)throw Error('Etapa não encontrada.');return {pair,stage};
}
export function moveTask(model,source,destination,beforeId=null) {
  const from=findStage(model,source),to=findStage(model,destination);
  if(source.side==='trello'&&isSupervision(from.stage)||destination.side==='trello'&&isSupervision(to.stage))throw Error('A Supervisão é editada somente pelo Gantt.');
  if(isSupervision(from.stage)&&(!isSupervision(to.stage)||destination.side!=='gantt'))throw Error('Uma atividade de Supervisão só pode ser movida para Supervisão no Gantt.');
  const index=from.stage.tasks.findIndex(t=>t.id===source.taskId);if(index<0)throw Error('Atividade não encontrada.');
  if(source.taskId===beforeId&&from.stage===to.stage)return;
  const [task]=from.stage.tasks.splice(index,1);
  const target=beforeId?to.stage.tasks.findIndex(t=>t.id===beforeId):-1;
  to.stage.tasks.splice(target<0?to.stage.tasks.length:target,0,task);
  mirrorSupervision(from.pair);if(from.pair!==to.pair)mirrorSupervision(to.pair);
}
