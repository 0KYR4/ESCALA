import {normalize} from './editor-model.mjs?v=20261105-2';

// IDs estáveis permitem reconhecer movimentos sem tratá-los como exclusão + criação.
function flatten(input){
  const result=new Map();
  const add=(id,parent,index,path,type,fields)=>result.set(id,{id,parent,index,path,type,fields});
  normalize(input).pairs.forEach((pair,pi)=>{
    const path=pair.gantt.name;
    add(pair.id,'root',pi,path,'Par de cartões',{'Tipo':({principal:'Principal',especializado:'Especializado',concessionaria:'Concessionária'})[pair.kind]});
    for(const side of ['gantt','trello']){
      const card=pair[side],cp=path+' / '+(side==='gantt'?'Gantt':'Trello');
      const cid=pair.id+':'+side;
      add(cid,pair.id,side==='gantt'?0:1,cp,'Cartão',{'Título':card.name,'Descrição':card.note,'Cor':card.color||(side==='gantt'?'#6293c5':'#49aa94')});
      card.stages.filter(s=>side!=='trello'||!s.supervision).forEach((stage,si)=>{
        const sp=cp+' / '+stage.name;
        add(stage.id,cid,si,sp,'Etapa',{'Nome':stage.name});
        stage.tasks.forEach((task,ti)=>add(task.id,stage.id,ti,sp+' / '+task.name,'Atividade',{'Texto':task.name,'Etiquetas':(task.tags||(task.status?[task.status]:[])).join(' · '),'Origem':task.nota_origem}));
      });
    }
  });
  return result;
}
export function compareModels(historical,current){
  const before=flatten(historical),after=flatten(current),changes=[];
  // Compara apenas irmãos existentes nos dois lados: inserir um item não reordena os demais.
  function ranks(own,other){const parents=new Map(),ranks=new Map();for(const entry of own.values())if(other.get(entry.id)?.parent===entry.parent){if(!parents.has(entry.parent))parents.set(entry.parent,[]);parents.get(entry.parent).push(entry);}for(const siblings of parents.values())siblings.sort((a,b)=>a.index-b.index).forEach((e,i)=>ranks.set(e.id,i));return ranks;}
  const oldRanks=ranks(before,after),newRanks=ranks(after,before);
  for(const old of before.values())if(!after.has(old.id))changes.push({action:'removed',type:old.type,path:old.path,fields:[]});
  for(const item of after.values()){
    const old=before.get(item.id);
    if(!old){changes.push({action:'added',type:item.type,path:item.path,fields:[]});continue;}
    const fields=[];
    for(const [name,value] of Object.entries(item.fields))if(old.fields[name]!==value)fields.push({name,before:old.fields[name],after:value});
    if(old.parent!==item.parent)fields.push({name:'Local',before:before.get(old.parent)?.path||'Mapa',after:after.get(item.parent)?.path||'Mapa'});
    else if(oldRanks.get(item.id)!==newRanks.get(item.id))fields.push({name:'Ordem',before:String(old.index+1),after:String(item.index+1)});
    if(fields.length)changes.push({action:'changed',type:item.type,path:item.path,fields});
  }
  return changes;
}
