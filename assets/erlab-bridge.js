// Serverlose postMessage-Bridge für die ER-Lab-Einbettung.
const cleanOrigin=value=>{try{return new URL(value,location.href).origin}catch{return null}};

export class ERLabClient {
  constructor({getFallbackDB, onState}={}){this.getFallbackDB=getFallbackDB;this.onState=onState;this.frame=null;this.pending=new Map();this.serial=0;this.listeners=new Set();this.key='desktopsim-v2-erlab-state';this.diagram=this.read();window.addEventListener('message',event=>this.receive(event));}
  read(){try{return JSON.parse(localStorage.getItem(this.key))||null}catch{return null}}
  setOS(os){this.key=`desktopsim-v2-erlab-state-${os}`;this.diagram=this.read()||this.diagramFromDB();}
  diagramFromDB(){return {tables:structuredClone(this.getFallbackDB?.()?.tables||{})};}
  save(diagram){this.diagram=structuredClone(diagram);try{localStorage.setItem(this.key,JSON.stringify(this.diagram))}catch{}this.listeners.forEach(fn=>fn(this.diagram));this.onState?.(this.diagram);}
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  attach(frame){this.frame=frame;frame.addEventListener('load',()=>this.load());}
  origin(){return cleanOrigin(this.frame?.src)||location.origin}
  post(message){if(!this.frame?.contentWindow)return false;this.frame.contentWindow.postMessage(message,this.origin());return true}
  load(){const diagram=this.diagram||this.diagramFromDB();this.save(diagram);this.post({type:'erlab:load',diagram});}
  async sql(sql){if(!this.frame?.contentWindow)return this.localSQL(sql,'ER Lab ist noch nicht eingebettet – lokale Lernkopie verwendet.');const requestId=`sql-${Date.now()}-${++this.serial}`;return new Promise(resolve=>{const timer=setTimeout(()=>{this.pending.delete(requestId);resolve(this.localSQL(sql,'ER Lab antwortet nicht – lokale Lernkopie verwendet.'));},2500);this.pending.set(requestId,{resolve,timer});this.post({type:'erlab:sql',requestId,sql});});}
  localSQL(sql,note=''){try{const raw=this.getFallbackDB().run(sql);return {columns:raw.columns||[],rows:raw.rows||[],affectedRows:raw.affectedRows??(/eingefügt|aktualisiert|gelöscht/i.test(raw.message||'')?Number((raw.message||'').match(/\d+/)?.[0]||0):0),error:null,message:[note,raw.message].filter(Boolean).join(' ')};}catch(error){return {columns:[],rows:[],affectedRows:0,error:error.message,message:note};}}
  receive(event){if(event.source!==this.frame?.contentWindow||event.origin!==this.origin())return;const data=event.data;if(!data||typeof data.type!=='string')return;if(data.type==='erlab:state'&&data.diagram)this.save(data.diagram);if(data.type==='erlab:sqlResult'&&data.requestId){const pending=this.pending.get(data.requestId);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(data.requestId);pending.resolve(data.result||{columns:[],rows:[],affectedRows:0,error:'Ungültige Antwort von ER Lab.'});}}
}

// Im ERDiagram-Modul importieren und bei Modell-/Datenänderungen bridge.announce() aufrufen.
export function createERLabHostBridge({getDiagram,loadDiagram,runSQL,allowedOrigins=[]}){
  const allowed=new Set(allowedOrigins.map(cleanOrigin).filter(Boolean));if(!allowed.size&&location.origin!=='null')allowed.add(location.origin);const permitted=origin=>allowed.has(origin);const reply=(target,origin,message)=>target?.postMessage(message,origin);const state=requestId=>({type:'erlab:state',...(requestId?{requestId}:{}),diagram:getDiagram()});const announce=()=>{if(window.parent!==window){const origin=[...allowed][0];if(origin)reply(window.parent,origin,state());}};
  window.addEventListener('message',async event=>{if(!permitted(event.origin)||!event.data?.type)return;const {type,requestId,diagram,sql}=event.data;if(type==='erlab:load'&&diagram){await loadDiagram(diagram);announce();}if(type==='erlab:getState')reply(event.source,event.origin,state(requestId));if(type==='erlab:sql'){let result;try{result=await runSQL(String(sql||''));result={columns:result.columns||[],rows:result.rows||[],affectedRows:result.affectedRows||0,error:null};}catch(error){result={columns:[],rows:[],affectedRows:0,error:error.message||'SQL konnte nicht ausgeführt werden.'};}reply(event.source,event.origin,{type:'erlab:sqlResult',requestId,result});announce();}});
  return {announce};
}

// Minimaler Browser-SQL-Executor für ein ER-Lab-Diagramm mit
// {tables:{Kurs:{columns:['id','titel'],rows:[...]}}}. Er bleibt absichtlich
// klein: genau eine Tabelle und optional WHERE feld = wert.
export function createERLabSQLExecutor({getDiagram,saveDiagram}){
  const value=raw=>{const text=String(raw).trim();if(/^null$/i.test(text))return null;if(/^[-+]?\d+(?:\.\d+)?$/.test(text))return Number(text);const quote=text.match(/^(['"])([\s\S]*)\1$/);if(quote)return quote[2].replaceAll(quote[1]+quote[1],quote[1]);throw Error(`Wert muss eine Zahl, NULL oder ein quotierter Text sein: ${text}`)};
  const table=(diagram,name)=>{const found=Object.entries(diagram.tables||{}).find(([key])=>key.toLowerCase()===name.toLowerCase());if(!found)throw Error(`Tabelle nicht gefunden: ${name}`);const [key,data]=found;if(!Array.isArray(data.rows))data.rows=[];if(!Array.isArray(data.columns))data.columns=Object.keys(data.rows[0]||{});return [key,data];};
  const matches=(rows,where)=>{if(!where)return rows;const found=where.match(/^([\w]+)\s*=\s*([\s\S]+)$/);if(!found)throw Error('Unterstützt wird nur WHERE Spalte = Wert.');const [,column,raw]=found;const expected=value(raw);return rows.filter(row=>String(row[column])===String(expected));};
  return sql=>{const diagram=getDiagram();if(!diagram||typeof diagram!=='object')throw Error('Kein ER-Lab-Modell geladen.');diagram.tables??={};const text=String(sql).trim().replace(/;$/,'');let match;
    if((match=text.match(/^SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i))){const [,fields,name,where]=match,[,data]=table(diagram,name),rows=matches(data.rows,where),columns=fields.trim()==='*'?data.columns:fields.split(',').map(item=>item.trim());columns.forEach(column=>{if(!data.columns.includes(column))throw Error(`Unbekannte Spalte: ${column}`)});return {columns,rows:rows.map(row=>Object.fromEntries(columns.map(column=>[column,row[column]]))),affectedRows:0};}
    if((match=text.match(/^INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i))){const [,name,rawCols,rawValues]=match,[,data]=table(diagram,name),columns=rawCols.split(',').map(item=>item.trim()),values=rawValues.split(',').map(value);if(columns.length!==values.length)throw Error('Spalten und Werte müssen gleich viele Einträge haben.');columns.forEach(column=>{if(!data.columns.includes(column))throw Error(`Unbekannte Spalte: ${column}`)});const row=Object.fromEntries(data.columns.map(column=>[column,null]));columns.forEach((column,index)=>row[column]=values[index]);data.rows.push(row);saveDiagram(diagram);return {columns:[],rows:[],affectedRows:1};}
    if((match=text.match(/^UPDATE\s+(\w+)\s+SET\s+([\w]+)\s*=\s*([\s\S]+?)(?:\s+WHERE\s+(.+))?$/i))){const [,name,column,raw,where]=match,[,data]=table(diagram,name);if(!data.columns.includes(column))throw Error(`Unbekannte Spalte: ${column}`);const selected=matches(data.rows,where);selected.forEach(row=>row[column]=value(raw));saveDiagram(diagram);return {columns:[],rows:[],affectedRows:selected.length};}
    if((match=text.match(/^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?$/i))){const [,name,where]=match,[,data]=table(diagram,name),selected=matches(data.rows,where);data.rows=data.rows.filter(row=>!selected.includes(row));saveDiagram(diagram);return {columns:[],rows:[],affectedRows:selected.length};}
    throw Error('Unterstützt werden SELECT, INSERT, UPDATE und DELETE für eine Tabelle.');
  };
}
