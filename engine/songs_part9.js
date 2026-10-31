/* ── 리얼북 5권 수록 (v0.16) ──
   Hal Leonard Real Book Vol.5 중 진행을 확실히 아는 곡만 수록.
   미수록: At Last, Send In the Clowns, Over the Rainbow, Star Eyes 등 진행 확정 곡 이외. */
RAW_SONGS.push(
{id:'almost-like-being-in-love',n:'Almost Like Being in Love',c:'스윙',k:10,bpm:140,f:['AAB',8],
 ch:'Bb6|Bb6|Cm7 F7|Bb6|C7|C7|F6|D7|Gm7|C7|F6|D7|Gm7|C7|F6|Bb6'},
{id:'crazy-rhythm',n:'Crazy Rhythm',c:'스윙',k:0,bpm:180,f:['AAB',8],
 ch:'C6|C6|A7|D7|G7|G7|C6|C6|C7|C7|F6|F6|A7|D7|G7|C7'},
{id:'every-breath-you-take',n:'Every Breath You Take',c:'모던',k:7,bpm:110,f:['AAB',8],
 ch:'Gm7|Gm7|Ebmaj7|Ebmaj7|Fm7|Bb7|Gm7|Gm7|Am7|D7|Gm7|C7|Fmaj7|Fmaj7|Cm7 F7|Gm7'},
{id:'goodbye-pork-pie-hat',n:'Goodbye Pork Pie Hat',c:'발라드',k:7,bpm:70,f:['AB',4],
 ch:'Gm7|Gm7|Gm7|Gm7|Cm7|Cm7|Gm7|Gm7|Ab7|Ab7|Gm7|Gm7|Am7b5 D7b9|Gm7|Cm7 D7b9|Gm7'},
{id:'i-get-a-kick-out-of-you',n:'I Get a Kick Out of You',c:'스윙',k:10,bpm:140,f:['AAB',8],
 ch:'Bbmaj7|Bbmaj7|Fm7 Bb7|Ebmaj7|Bbmaj7|Bbmaj7|Cm7 F7|Bbmaj7|C7|C7|Fmaj7|Fmaj7|Dm7b5 G7|Cm7 F7|Bbmaj7|Cm7 F7'},
{id:'im-in-the-mood-for-love',n:"I'm in the Mood for Love",c:'발라드',k:5,bpm:100,f:['AAB',8],
 ch:'Fmaj7|Fmaj7|Bm7b5 E7|Am7|D7|D7|Gm7 C7|Fmaj7|Bbmaj7|Bbmaj7|Ebmaj7|Ebmaj7|C7|Fmaj7|Gm7 C7|Fmaj7'},
{id:'in-your-own-sweet-way',n:'In Your Own Sweet Way',c:'모던',k:10,bpm:110,f:['AAB',8],
 ch:'Bbmaj7|Bbmaj7|Fm7 Bb7|Ebmaj7|Bbmaj7|Bbmaj7|Am7b5 D7|Gm7 C7|Ebmaj7|Ebmaj7|Dm7|G7|Cm7|F7|Bbmaj7|Bbmaj7'},
{id:'love-is-here-to-stay',n:'Love Is Here to Stay',c:'스윙',k:5,bpm:120,f:['AAB',8],
 ch:'Gm7|C7|Fmaj7|Fmaj7|D7|G7|Cmaj7|Cmaj7|Bbmaj7|Bbmaj7|Bm7b5 E7|Am7|D7|D7|Gm7 C7|Fmaj7'},
{id:'moondance',n:'Moondance',c:'모던',k:9,bpm:130,f:['AAB',8],
 ch:'Am7|Am7|Bm7|Bm7|Am7|Am7|Fmaj7|Fmaj7|Cmaj7|Cmaj7|Am7|Am7|Bm7|Em7|Am7|Am7'},
{id:'oh-lady-be-good',n:'Oh, Lady Be Good!',c:'스윙',k:7,bpm:160,f:['AAB',8],
 ch:'G6|B7|Em7|A7|D7|G7|C7 D7|G6|G6|B7|Em7|A7|D7|G7|C7 D7|G6'},
{id:'one-oclock-jump',n:"One O'Clock Jump",c:'스윙',k:10,bpm:180,f:['AAB',4],
 ch:'Bb7|Eb7|Bb7|Bb7|Eb7|Eb7|Bb7|Bb7|F7|Eb7|Bb7|F7'},
{id:'tequila',n:'Tequila',c:'라틴',k:2,bpm:120,f:['AAB',4],
 ch:'D7|D7|D7|D7|G7|G7|D7|D7|A7|A7|D7|A7'}
);
RAW_SONGS.slice(-12).forEach(s=>{SONGDB[s.id]={name:s.n,c:s.c,key:s.k,bpm:s.bpm,bpb:s.m||4,form:{phrase:s.f[1],sections:s.f[0]},bars:s.ch.split('|').map(b=>b.trim().split(/\s+/).map(parseCh))}});
