// Agenda por alteração, nunca por intervalo. Uma gravação em andamento não se sobrepõe.
export function createDraftAutosave({write,onState=()=>{},delay=1500,schedule=setTimeout,cancel=clearTimeout}) {
  let timer=null,pending=null,saved=null,running=false,stopped=false,inflight=null;
  const key=value=>JSON.stringify([value.payload,value.baseRevision]);
  function queue(value){
    if(stopped)return;
    pending=value;
    if(timer!==null)cancel(timer);
    timer=null;
    if(!running&&key(pending)!==saved){onState('pending');timer=schedule(flush,delay);}
  }
  async function flush(){
    timer=null;
    if(stopped||running||!pending||key(pending)===saved)return;
    const value=pending;running=true;onState('saving');
    try{inflight=write(value);await inflight;saved=key(value);onState('saved');}
    catch(error){onState('error',error);running=false;return;}
    running=false;
    if(!stopped&&key(pending)!==saved)queue(pending);
  }
  return {queue,flush,async settled(){try{await inflight;}catch{}},remember(value){saved=key(value);},stop(){stopped=true;if(timer!==null)cancel(timer);}};
}
