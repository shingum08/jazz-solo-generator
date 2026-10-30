const fs=require('fs');
const code=fs.readFileSync(process.argv[2]||'engine_core.js','utf8')+'\n'+(process.argv[3]?'':fs.readFileSync('style_data.js','utf8'))+'\nmodule.exports={generateSolo,toAbc,PROGS,KEY_ROOTS,analyzeHarmony,barChords,CHORD_TYPES,STYLE_DATA:typeof STYLE_DATA!=="undefined"?STYLE_DATA:null};';
fs.writeFileSync('/tmp/opencode_eng.js',code);
const E=require('/tmp/opencode_eng.js');
const styles=E.STYLE_DATA?Object.keys(E.STYLE_DATA.profiles):['all'];
let N=0,viol={bar:0,range:0,leap:0,trip:0,overlap:0},m={ctStrong:0,strong:0,notes:0,rests:0,guideOnChange:0,changes:0,chromNon:0,leaps5:0,ivs:0,stepwise:0,rep:0,landTarget:0},errs=[];
const S=(x)=>x;
for(const prog of Object.keys(E.PROGS))for(const [kn,kp] of E.KEY_ROOTS)for(const diff of [1,2,3])for(const inst of ['brass','wind','free'])for(let sd=1;sd<=3;sd++){
  const style=styles[(sd+diff)%styles.length];
  let solo;try{solo=E.generateSolo(prog,kp,diff,sd*7919+diff,inst,{style});}catch(e){errs.push(prog+kn+diff+inst+': '+e.stack.split('\n').slice(0,3).join(' | '));continue}
  N++;
  const RG={brass:[59,82],wind:[59,82],free:[52,86]}[inst];
  const harm=E.analyzeHarmony(E.barChords(E.PROGS[prog],kp),kp);
  const segAt=t=>{for(let i=harm.length-1;i>=0;i--)if(harm[i].t0<=t)return harm[i];return harm[0]};
  let pv=null,pvt=-99;
  solo.bars.forEach((bar,b)=>{
    const sum=bar.notes.reduce((a,n)=>a+n.d,0);if(sum!==24){viol.bar++; if(viol.bar<4)errs.push('bar sum '+sum+' '+prog+diff+inst+' b'+b+JSON.stringify(bar.notes))}
    let t=0;for(const n of bar.notes){if(n.t!==t)viol.overlap++;t+=n.d}
    let tc=0;for(const n of bar.notes){if(n.trip)tc++;else{if(tc%3)viol.trip++;tc=0}}if(tc%3)viol.trip++;
    bar.notes.forEach((n,k)=>{
      const prevTie=k>0?bar.notes[k-1].tie:(b>0&&solo.bars[b-1].notes.length?solo.bars[b-1].notes[solo.bars[b-1].notes.length-1].tie:false);
      if(n.midi===null){m.rests++;return}
      if(prevTie)return;
      if(n.midi<RG[0]||n.midi>RG[1])viol.range++;
      m.notes++;
      const T=b*24+n.t,sg=segAt(T),rel=((n.midi-sg.root)%12+12)%12;
      const ct=sg.ct.includes(rel),sc=sg.scale.includes(rel);
      if(n.t%6===0){m.strong++;if(ct)m.ctStrong++}
      if(!ct&&!sc)m.chromNon++;
      if(T===sg.t0&&sg.t0>0){m.changes++;if(sg.guide.includes(rel))m.guideOnChange++;if(ct)m.landTarget++}
      if(pv!==null){const d=Math.abs(n.midi-pv);m.ivs++;if(d<=2&&d>0)m.stepwise++;if(d===0)m.rep++;if(d>=7)m.leaps5++;if(inst!=='free'&&d>7)viol.leap++}
      pv=n.midi;
    });
  });
  const abc=E.toAbc(solo,120,0);
}
console.log('solos',N,'errors',errs.length);errs.slice(0,6).forEach(e=>console.log(' ',e));
console.log('violations',viol);
const r=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
console.log({ctOnStrong:r(m.ctStrong,m.strong),chordToneOnChange:r(m.landTarget,m.changes),guideOnChange:r(m.guideOnChange,m.changes),chromatic:r(m.chromNon,m.notes),stepwise:r(m.stepwise,m.ivs),repeat:r(m.rep,m.ivs),leap5plus:r(m.leaps5,m.ivs),restShare:r(m.rests,m.rests+m.notes)});
