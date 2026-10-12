const {Compiler}=require('inkjs/full');
const fs=require('fs');
let bad=0;
for(const f of process.argv.slice(2)){
  const src=fs.readFileSync(f,'utf8');
  let c_err=null; try{
    const c=new Compiler(src); try{c.Compile();}catch(ee){c_err=c.errors; throw ee;}
    const w=(c.warnings||[]).filter(x=>!/EXTERNAL|external/.test(x));
    console.log('OK',f,w.length?w.slice(0,3):'');
  }catch(e){bad++;console.log("FAIL",f,(e.message||e).toString().slice(0,300), JSON.stringify((c_err||[]).slice(0,5)));}
}
process.exit(bad?1:0);
