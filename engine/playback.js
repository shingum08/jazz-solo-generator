/* ── Web Audio 재생 엔진 v0.18 (룩어헤드 스케줄러 · 코러스별 솔로) ──
   · 스윙비: WJD 실측(템포별 중앙값 120BPM 0.63 → 280BPM 0.54) + 연주자 프로필 보정
   · 아티큘레이션: 붙임줄 음은 한 소리로, 엇박 8분 살짝 강조(비밥 악센트), 라인 속 낮은 음은 고스트,
     프레이즈 끝음은 길게 + 비브라토, 레가토 겹침
   · 반주: 가이드톤 기반 루트리스 보이싱(A/B형 교대, 보이스리딩), 박마다 화성을 읽는 워킹 베이스 */
const SWING_TABLE=[[60,0.53],[100,0.60],[140,0.626],[180,0.627],[220,0.60],[260,0.577],[300,0.54]];
function swingRatio(bpm,style){
  let r=SWING_TABLE[0][1];
  for(let i=0;i<SWING_TABLE.length-1;i++){const [a,ra]=SWING_TABLE[i],[b,rb]=SWING_TABLE[i+1];
    if(bpm>=a&&bpm<=b){r=ra+(rb-ra)*(bpm-a)/(b-a);break}if(bpm>b)r=rb}
  const off=(typeof STYLE_DATA!=='undefined'&&STYLE_DATA.profiles[style])?STYLE_DATA.profiles[style].swingOff||0:0;
  return Math.max(0.52,Math.min(0.68,r+off));
}
function midiFreq(m){return 440*Math.pow(2,(m-69)/12)}
function tickToBeat(t,sw){const beat=Math.floor(t/6),r=t%6;const fr={0:0,2:1/3,3:sw,4:2/3,1:1/6,5:5/6}[r];return beat+fr}
function buildAudioEvents(solo,bpm,sw){
  const spb=60/bpm,evs=[];
  const TPB=(solo.bpb||4)*6;
  const flat=[];solo.bars.forEach((bar,bi)=>bar.notes.forEach(n=>flat.push({...n,T:bi*TPB+n.t})));
  for(let i=0;i<flat.length;i++){
    const n=flat[i];
    if(n.midi===null)continue;
    if(i>0&&flat[i-1].tie&&flat[i-1].midi===n.midi)continue;
    let endT=n.T+n.d,k=i;
    while(flat[k].tie&&flat[k+1]&&flat[k+1].midi===n.midi){k++;endT=flat[k].T+flat[k].d}
    const st=tickToBeat(n.T,sw)*spb,en=tickToBeat(endT,sw)*spb;
    const nx=flat[k+1];
    const legato=nx&&nx.midi!==null&&nx.T===endT;
    let dur=(en-st)*(legato?1.02:0.86);
    const isOff=n.T%6===3&&!n.trip;
    const pv=flat[i-1]&&flat[i-1].midi!==null?flat[i-1].midi:null;
    let vel=0.82;
    if(isOff)vel=0.95;                                    /* 엇박 8분 강조 */
    if(n.t%24===0)vel=Math.max(vel,0.9);
    if(pv!==null&&n.midi<pv-2&&n.d<=3&&!isOff)vel=0.62;   /* 하행 라인의 박 위 음은 살짝 고스트 */
    if(n.phStart)vel=Math.max(vel,0.9);
    const isEnd=!!(n.phEnd||flat[k].phEnd)||(endT-n.T)>=9;
    evs.push({start:st,dur:Math.max(0.06,dur),midi:n.midi,vel,end:isEnd});
  }
  return evs;
}
/* 워킹 베이스 — 박마다 그 박의 코드를 읽는다. 1박 근음, 4박은 다음 근음으로 반음/5도 어프로치 */
function bassLine(solo,seed){
  const BPB=solo.bpb||4;
  const rng=mulberry32((seed||1)*31+7);
  const N=m=>{while(m<40)m+=12;while(m>55)m-=12;return m};
  const beats=[];
  solo.bars.forEach(bar=>{for(let k=0;k<BPB;k++){const ch=bar.chords[(k>=Math.ceil(BPB/2)&&bar.chords.length>1)?1:0];beats.push(ch)}});
  const out=[];let prev=N(beats[0].root+40);
  for(let i=0;i<beats.length;i++){
    const ch=beats[i],nx=beats[(i+1)%beats.length];
    const iv=CHORD_TYPES[ch.type].iv,sc=CHORD_TYPES[ch.type].scale;
    const chordStart=i===0||beats[i-1]!==ch;
    const nextChange=nx!==ch;
    let m;
    if(chordStart){m=nearest([N(ch.root),N(ch.root)+12].filter(x=>x<=57),prev)}
    else if(nextChange){
      const tgt=nearest([N(nx.root),N(nx.root)+12,N(nx.root)-12].filter(x=>x>=38&&x<=57),prev);
      const r=rng();
      m=r<0.55?(prev<tgt?tgt-1:tgt+1):(r<0.8?tgt+7-12*(tgt+7>55?1:0):(prev<tgt?tgt-2:tgt+2));
      if(Math.abs(m-prev)>9)m=prev<tgt?tgt-1:tgt+1;
    }else{
      const pool=[];for(let o=36;o<=57;o++){const rel=((o-ch.root)%12+12)%12;if(iv.includes(rel)||sc.includes(rel))pool.push({v:o,w:(iv.includes(rel)?2.2:1)*Math.exp(-Math.abs(o-prev)/3)*(o===prev?0.05:1)})}
      m=pickW(rng,pool);
    }
    while(m>57)m-=12;while(m<36)m+=12;
    out.push(m);prev=m;
  }
  const bars=[];for(let b=0;b<solo.bars.length;b++)bars.push(out.slice(b*BPB,b*BPB+BPB));
  return bars;
}
/* 루트리스 보이싱 — 3·7 + 9·13(또는 5) / A형(3-5-7-9) · B형(7-9-3-5) 중 가까운 쪽 */
function voicingFor(ch,prevV){
  const t=ch.type,r=ch.root,cls=TYPE_CLS[t];
  const sets={maj:[[4,7,11,14],[11,14,16,19]],min:[[3,7,10,14],[10,14,15,19]],dom:[[4,9,10,14],[10,14,16,21]],
    domalt:[[4,8,10,13],[10,13,16,20]],hdim:[[3,6,10,12],[10,12,15,18]],dim:[[3,6,9,12],[9,12,15,18]]};
  if(t==='6')sets.maj=[[4,7,9,14],[9,14,16,19]];
  if(t==='m6')sets.min=[[3,7,9,14],[9,14,15,19]];
  let best=null;
  for(const form of sets[cls]||sets.maj){
    for(let base=48;base<=62;base++){
      if(((base-r)%12+12)%12!==0)continue;
      const v=form.map(x=>base+x);
      if(v[0]<52||v[3]>74)continue;
      const cost=prevV?v.reduce((a,x,k)=>a+Math.abs(x-prevV[k]),0):Math.abs(v[0]-58);
      if(!best||cost<best.cost)best={v,cost};
    }
  }
  return best?best.v:[r+52,r+56,r+59,r+62];
}
function playAllInner(){
  /* v0.18 — 룩어헤드 스케줄러: 모든 음을 한 번에 만들지 않고 1초 앞까지만 예약(브라우저 부하·무음 방지)
     코러스마다 서로 다른 솔로(cur.solos[c])를 이어서 재생 */
  stopAll();
  const sols=(cur.solos&&cur.solos.length)?cur.solos:[cur.solo];
  const bpm=+$('#bpm').value;
  const bpb=sols[0].bpb||4;
  const sw=swingRatio(bpm,cur.style);
  const ac=new (window.AudioContext||window.webkitAudioContext)();
  if(ac.resume)ac.resume();  /* 자동재생 정책: suspended 해제 */
  const master=ac.createGain();master.gain.value=0.75;
  const comp=ac.createDynamicsCompressor();
  master.connect(comp);comp.connect(ac.destination);
  const rb=ac.createGain();
  rb.gain.value=Math.max(0,(+$('#backvol').value||90)/100)*2.6;
  rb.connect(master);
  const spb=60/bpm,t0=ac.currentTime+0.15,start=t0+4*spb;
  const nb=sols[0].bars.length,barLen=bpb*spb,chLen=nb*barLen,nCh=sols.length;
  cur.audio={ac,master,raf:null,timer:null,start,chLen,barLen,nCh,nb,endAt:start+nCh*chLen};
  const jobs=[];
  for(let i=0;i<4;i++){const tt=t0+i*spb;jobs.push({t:tt,f:()=>click(ac,master,tt,i===0?1400:1000,i===0?0.5:0.3)})}
  const rng=mulberry32((cur.seed||1)*13+5);
  /* 컴핑: 찰스턴·푸시(4&→1)·2&·4박 등 싱커페이션 — 마디마다 확률적으로 고른다 */
  const COMP=bpb===3?[[0,1+sw],[0+sw,2],[1,2+sw],[0,1]]:(bpb===5?[[0,2+sw],[1+sw,3],[0,3+sw],[2,4],[1,4]]:[[0,1+sw],[0+sw,2+sw],[1+sw,3],[0,2+sw],[1,3+sw],[sw,3]]);
  let prevV=null;
  sols.forEach((so,cr)=>{
    const bl=bassLine(so,(cur.seed||1)+cr*7919);
    so.bars.forEach((bar,bi)=>{
      const barStart=start+cr*chLen+bi*barLen;
      jobs.push({t:barStart-0.05,f:()=>{
        const pat=COMP[Math.floor(rng()*COMP.length)];
        pat.forEach(bt=>{
          const beatAbs=bt%bpb;
          const ch=bar.chords[(beatAbs>=bpb/2&&bar.chords.length>1)?1:0];
          const v=voicingFor(ch,prevV);prevV=v;
          const len=(bt%1===0?0.9:0.55)*spb;
          pianoHit(ac,rb,barStart+tickToBeat(Math.round(beatAbs*6),sw)*spb,len,v,0.12);
        });
        if(bar.chords.length>1&&!pat.some(bt=>bt>=bpb/2)){const v=voicingFor(bar.chords[1],prevV);prevV=v;pianoHit(ac,rb,barStart+tickToBeat(Math.ceil(bpb/2)*6,sw)*spb,0.8*spb,v,0.11)}
        bl[bi].forEach((m,k)=>bass(ac,rb,barStart+k*spb,0.92*spb,m,k===0?1:(k%2?0.8:0.9)));
        if(bpb===4){
          kick(ac,rb,barStart,0.25);
          snare(ac,rb,barStart+1*spb,0.12);snare(ac,rb,barStart+3*spb,0.12);
          if(rng()<0.25)snare(ac,rb,barStart+(2+sw)*spb,0.05);
          [0,1,1+sw,2,3,3+sw].forEach(bt=>ridePing(ac,rb,barStart+bt*spb,bt%1?0.045:(bt%2?0.08:0.065)));
          hat(ac,rb,barStart+1*spb,0.08);hat(ac,rb,barStart+3*spb,0.08);
        }else{  /* 왈츠·5/4 — 1박 킥, 나머지 박 가벼운 스네어, 박마다 라이드 */
          kick(ac,rb,barStart,0.25);
          for(let k=1;k<bpb;k++)snare(ac,rb,barStart+k*spb,0.10);
          for(let k=0;k<bpb;k++){ridePing(ac,rb,barStart+k*spb,k%2?0.05:0.07);if(bpb===5||k%2===0)ridePing(ac,rb,barStart+(k+sw)*spb,0.04)}
          for(let k=1;k<bpb;k++)hat(ac,rb,barStart+k*spb,0.07);
        }
      }});
    });
    if(cur.playSolo!==false)buildAudioEvents(so,bpm,sw).forEach(e=>{
      const tt=start+cr*chLen+e.start;
      jobs.push({t:tt-0.02,f:()=>mel(ac,master,tt,e.dur,e.midi,cur.tone||'flugel',e.vel,e.end)});
    });
  });
  jobs.sort((x,y)=>x.t-y.t);
  let ji=0;
  const LA=(typeof window!=='undefined'&&window.__PB_LOOKAHEAD)||1.0;
  const au=cur.audio;
  const pump=()=>{
    if(cur.audio!==au)return;
    const h=ac.currentTime+LA;
    while(ji<jobs.length&&jobs[ji].t<h){try{jobs[ji].f()}catch(e){console.error('스케줄 오류:',e)}ji++}
  };
  pump();au.timer=setInterval(pump,50);
  const loop=()=>{
    if(cur.audio!==au)return;
    const el=ac.currentTime-start;
    if(el>=0&&el<nCh*chLen){
      const cr=Math.floor(el/chLen),bi=Math.floor((el-cr*chLen)/barLen);
      if(typeof onPlayPos==='function'){try{onPlayPos(cr,bi)}catch(e){}}  /* 화면 갱신 오류가 재생을 멈추지 않게 */
    }
    if(ac.currentTime>au.endAt+1.2){stopAll();$('#btnPlay').textContent='▶ 재생';return}
    au.raf=requestAnimationFrame(loop);
  };
  loop();
}
function click(ac,out,when,freq,vol){
  const o=ac.createOscillator(),g=ac.createGain();
  o.frequency.value=freq;o.type='square';
  g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(0.001,when+0.06);
  o.connect(g);g.connect(out);o.start(when);o.stop(when+0.08);
}
function pianoHit(ac,out,when,dur,midis,vol){
  midis.forEach((m,k)=>{
    const o=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();
    o.type='triangle';o.frequency.value=midiFreq(m);
    o2.type='sine';o2.frequency.value=midiFreq(m)*2;
    f.type='lowpass';f.frequency.value=2200;
    const g2=ac.createGain();g2.gain.value=0.25;
    const w=when+k*0.006;  /* 살짝 롤 */
    g.gain.setValueAtTime(0.0001,w);
    g.gain.exponentialRampToValueAtTime(vol,w+0.012);
    g.gain.exponentialRampToValueAtTime(vol*0.45,Math.max(w+0.18,w+0.013));
    g.gain.exponentialRampToValueAtTime(0.001,Math.max(w+dur,w+0.181));
    o.connect(f);o2.connect(g2);g2.connect(f);f.connect(g);g.connect(out);
    o.start(w);o.stop(w+dur+0.05);o2.start(w);o2.stop(w+dur+0.05);
  });
}
function bass(ac,out,when,dur,midi,vel){
  vel=vel||1;
  const f=midiFreq(midi);
  const o=ac.createOscillator(),o2=ac.createOscillator(),g=ac.createGain(),fl=ac.createBiquadFilter();
  o.type='triangle';o.frequency.value=f;
  o2.type='square';o2.frequency.value=f*2;
  fl.type='lowpass';fl.frequency.setValueAtTime(1100,when);fl.frequency.exponentialRampToValueAtTime(500,when+0.15);
  const g2=ac.createGain();g2.gain.value=0.16;
  o2.connect(g2);g2.connect(fl);o.connect(fl);fl.connect(g);g.connect(out);
  g.gain.setValueAtTime(0.0001,when);
  g.gain.exponentialRampToValueAtTime(0.62*vel,when+0.01);
  g.gain.exponentialRampToValueAtTime(0.3*vel,Math.max(when+Math.min(0.14,dur*0.6),when+0.011));
  g.gain.exponentialRampToValueAtTime(0.001,Math.max(when+dur,when+Math.min(0.14,dur*0.6)+0.001));
  o.start(when);o.stop(when+dur+0.05);o2.start(when);o2.stop(when+dur+0.05);
}
function kick(ac,out,when,vol){
  const o=ac.createOscillator(),g=ac.createGain();
  o.type='sine';o.frequency.setValueAtTime(150,when);o.frequency.exponentialRampToValueAtTime(50,when+0.09);
  g.gain.setValueAtTime(vol||0.5,when);g.gain.exponentialRampToValueAtTime(0.001,when+0.16);
  o.connect(g);g.connect(out);o.start(when);o.stop(when+0.18);
}
function noiseBuf(ac,len){const b=ac.createBuffer(1,ac.sampleRate*len,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
function snare(ac,out,when,vol){
  if(!ac._sn)ac._sn=noiseBuf(ac,0.2);
  const n=ac.createBufferSource(),g=ac.createGain(),f=ac.createBiquadFilter();
  n.buffer=ac._sn;f.type='bandpass';f.frequency.value=2100;f.Q.value=0.7;
  g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(0.001,when+0.13);
  n.connect(f);f.connect(g);g.connect(out);n.start(when);n.stop(when+0.15);
}
function hat(ac,out,when,vol){
  if(!ac._ht)ac._ht=noiseBuf(ac,0.1);
  const n=ac.createBufferSource(),g=ac.createGain(),f=ac.createBiquadFilter();
  n.buffer=ac._ht;f.type='highpass';f.frequency.value=6500;
  g.gain.setValueAtTime(vol,when);g.gain.exponentialRampToValueAtTime(0.001,when+0.05);
  n.connect(f);f.connect(g);g.connect(out);n.start(when);n.stop(when+0.07);
}
function ridePing(ac,out,when,vol){
  if(!ac._rd)ac._rd=noiseBuf(ac,0.5);
  const n=ac.createBufferSource(),g=ac.createGain(),f=ac.createBiquadFilter(),f2=ac.createBiquadFilter();
  n.buffer=ac._rd;f.type='bandpass';f.frequency.value=5200;f.Q.value=2.2;f2.type='highpass';f2.frequency.value=3000;
  g.gain.setValueAtTime(vol||0.07,when);g.gain.exponentialRampToValueAtTime((vol||0.07)*0.3,when+0.05);g.gain.exponentialRampToValueAtTime(0.001,when+0.38);
  n.connect(f);f.connect(f2);f2.connect(g);g.connect(out);n.start(when);n.stop(when+0.4);
  const o=ac.createOscillator(),og=ac.createGain();o.type='sine';o.frequency.value=5800;  /* 벨 톤 */
  og.gain.setValueAtTime((vol||0.07)*0.12,when);og.gain.exponentialRampToValueAtTime(0.0005,when+0.3);
  o.connect(og);og.connect(out);o.start(when);o.stop(when+0.32);
}
function mel(ac,out,when,dur,midi,tone,vel,isEnd){
  tone=tone||'flugel';vel=vel||0.85;
  const g=ac.createGain(),f=ac.createBiquadFilter();
  f.type='lowpass';
  let oscs=[];
  const fr=midiFreq(midi);
  if(tone==='clarinet'){
    const o=ac.createOscillator();o.type='square';o.frequency.value=fr;
    f.frequency.value=1300+700*vel;oscs=[[o,0.8]];
  }else if(tone==='flugel'){
    const o=ac.createOscillator(),o2=ac.createOscillator(),o3=ac.createOscillator();
    o.type='sine';o2.type='sine';o3.type='triangle';
    o.frequency.value=fr;o2.frequency.value=fr*2;o3.frequency.value=fr;
    f.frequency.setValueAtTime(700,when);f.frequency.linearRampToValueAtTime(900+1000*vel,when+0.05);  /* 브라스 블룸 */
    oscs=[[o,1],[o2,0.22],[o3,0.35]];
  }else{
    const o=ac.createOscillator(),o2=ac.createOscillator();
    o.type='triangle';o2.type='sine';o.frequency.value=fr;o2.frequency.value=fr*2.001;
    f.frequency.value=2600;oscs=[[o,1],[o2,1]];
  }
  if(tone!=='default'&&(dur>0.4||isEnd)){
    const lfo=ac.createOscillator(),lg=ac.createGain();
    lfo.frequency.value=5.4;
    const vs=when+Math.min(0.3,dur*0.45);
    lg.gain.setValueAtTime(0,when);lg.gain.setValueAtTime(0,vs);lg.gain.linearRampToValueAtTime(fr*0.007,vs+0.25);
    lfo.connect(lg);oscs.forEach(([o])=>lg.connect(o.frequency));
    lfo.start(when);lfo.stop(when+dur+0.1);
  }
  /* 짧은 아래→제 음 스쿱(프레이즈 첫 음·긴 음에만) */
  if(tone!=='default'&&dur>0.3)oscs.forEach(([o])=>{o.frequency.setValueAtTime(fr*0.985,when);o.frequency.exponentialRampToValueAtTime(fr,when+0.05)});
  const peak=0.24*vel;
  const atk=tone==='default'?0.012:(tone==='clarinet'?0.022:0.03);
  const t1=when+atk,t2=when+atk+0.06,t3=when+Math.max(atk+0.07,dur-0.06),t4=when+dur+(isEnd?0.12:0.03);
  g.gain.setValueAtTime(0.0001,when);
  g.gain.exponentialRampToValueAtTime(peak,t1);
  g.gain.exponentialRampToValueAtTime(peak*0.82,Math.max(t2,t1+0.001));
  g.gain.setValueAtTime(peak*0.82,Math.max(t3,t2+0.001));
  g.gain.exponentialRampToValueAtTime(0.001,Math.max(t4,t3+0.001));
  oscs.forEach(([o,vol])=>{
    const vg=ac.createGain();vg.gain.value=vol;
    o.connect(vg);vg.connect(f);
    o.start(when);o.stop(when+dur+0.2);
  });
  f.connect(g);g.connect(out);
}
function stopAll(){
  if(cur.audio){
    if(cur.audio.raf)cancelAnimationFrame(cur.audio.raf);
    if(cur.audio.timer)clearInterval(cur.audio.timer);
    try{cur.audio.ac.close()}catch(e){}
    cur.audio=null;
    [...$('#chips').children].forEach(c=>c.classList.remove('lit'));
  }
}

/* ── 재생 예외 복구: 조용한 실패 대신 화면에 원인을 표시 ── */
function playAll(){
  try{playAllInner()}
  catch(e){
    console.error('재생 오류:',e);
    stopAll();$('#btnPlay').textContent='▶ 재생';
    try{$('#paperTitle').textContent='⚠ 재생 오류: '+e.message}catch(_){}
  }
}