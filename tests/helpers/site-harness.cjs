/* eslint-disable @typescript-eslint/no-require-imports -- Local isolated TSX harness; never contacts services. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
const compile = (file) => ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: file }).outputText;
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (mod, file) => mod._compile(compile(file), file);
const settle = async () => { for (let i=0;i<25;i++) await new Promise(resolve => setImmediate(resolve)); };
function harness(relative, options = {}) {
  const state=[], effects=[], queries=[], calls=[];
  let cursor=0, effectCursor=0, props=options.props || {}, collecting=true;
  const hooks={...React,
    useState(initial) { const i=cursor++; if (!(i in state)) state[i]=typeof initial==='function'?initial():initial; return [state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v;}]; },
    useRef(initial) {const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];},
    useCallback(fn){return fn;},
    useEffect(fn){if(collecting)effects[effectCursor++]=fn;},
  };
  const supabase={auth:{getUser:async()=>({data:{user:{id:'test-user'}}}),getSession:async()=>({data:{session:{access_token:'local-only'}}})},
    rpc(name,args){return query({name,args});},from(table){return query({table});}};
  function query(info){const q={...info,ops:[]};queries.push(q);const chain=new Proxy({}, {get(_,key){if(key==='then')return (resolve,reject)=>Promise.resolve().then(()=>options.respond?options.respond(q):({data:q.name?{clinica_id:'tenant-a',nome:'Empresa TESTE LOCAL'}:[],error:null})).then(resolve,reject);return (...args)=>{q.ops.push([key,...args]);return chain;};}});return chain;}
  const fetchLocal=async(url,init)=>{calls.push({url,init});if(options.fetch)return options.fetch(url,init);if(url!=='/api/minha-clinica')throw Error('Unexpected network: '+url);return {ok:true,json:async()=>({clinica_id:'tenant-a',nome:'Empresa TESTE LOCAL'})};};
  const file=path.join(root,relative), realRequire=Module.createRequire(file),mod={exports:{}};
  const localRequire=spec=> spec==='react'?hooks:spec.endsWith('/lib/supabase')?{supabase}:spec==='next/navigation'?{useRouter:()=>({push(){}}),usePathname:()=>'/site'}:spec.endsWith('/AdminShell')?{__esModule:true,default:({children})=>React.createElement('main',null,children)}:spec.endsWith('/SiteWorkspaceNav')?{__esModule:true,default:()=>null}:realRequire(spec);
  const windowLocal={location:{origin:'https://local.invalid'},matchMedia:()=>({matches:true})};
  new Function('exports','require','module','fetch','window','console',compile(file))(mod.exports,localRequire,mod,fetchLocal,windowLocal,{error(){}});
  let cleanups=[];
  function page(){cursor=0;effectCursor=0;return mod.exports.default(props);}
  async function load(nextProps=props){cleanups.forEach(fn=>fn?.());props=nextProps;collecting=true;page();collecting=false;cleanups=effects.map(fn=>fn());await settle();return page();}
  function html(){return renderToStaticMarkup(page());}
  function find(predicate, node=page()){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of React.Children.toArray(node.props?.children)){const found=find(predicate,child);if(found)return found;}return null;}
  return {state,queries,calls,page,load,html,find,settle};
}
module.exports={harness,settle,React,root};
