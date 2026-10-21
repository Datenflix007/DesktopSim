// Python läuft in einem isolierten Web Worker. Pyodide wird nur bei Bedarf vom CDN geladen.
let pyodidePromise;
async function getRuntime(){
  if(!pyodidePromise)pyodidePromise=import('https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs')
    .then(mod=>mod.loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'}));
  return pyodidePromise;
}
self.onmessage=async ({data})=>{
  const{id,source}=data;
  try{
    const py=await getRuntime();
    await py.loadPackagesFromImports(source);
    py.globals.set('__ds_user_code',String(source));
    const result=await py.runPythonAsync(`import io, contextlib, traceback\n__ds_out = io.StringIO()\nwith contextlib.redirect_stdout(__ds_out), contextlib.redirect_stderr(__ds_out):\n    try:\n        exec(compile(__ds_user_code, '<DesktopSim>', 'exec'), {'__name__': '__main__'})\n    except Exception:\n        traceback.print_exc()\n__ds_out.getvalue()`);
    self.postMessage({id,output:String(result).slice(0,40000)});
  }catch(e){self.postMessage({id,error:String(e?.message||e)})}
};
