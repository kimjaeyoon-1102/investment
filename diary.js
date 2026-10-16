// Investment diary: trades, current prices and dated snapshots, kept in this browser's localStorage.
(()=>{
 const store='chagok-diary-v1';
 const blank=()=>({trades:[],prices:{},fx:Number($('fx').value)||1400,entries:[]});
 let state=blank(),undo=null,storageOk=true;
 try{const saved=JSON.parse(localStorage.getItem(store));if(saved&&Array.isArray(saved.trades))state={...blank(),...saved};}catch{}
 function save(){try{localStorage.setItem(store,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}}
 const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
 const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const presets=funds.filter(f=>f.id!=='CUSTOM');
 const preset=sym=>presets.find(f=>f.id===sym);
 const nameOf=sym=>preset(sym)?.label||sym;
 const qtyText=q=>(+q.toFixed(6)).toLocaleString('ko-KR',{maximumFractionDigits:6})+'주';
 const ccyText=(n,c)=>c==='USD'?usd(n):won(n);
 const signed=n=>(n>0?'+':n<0?'−':'')+won(Math.abs(n));
 const pctText=n=>Number.isFinite(n)?(n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(2)+'%':'—';
 const tone=n=>n>0?'up':n<0?'down':'';

 // Average-cost positions in KRW. A USD trade converts at the rate recorded with it; the fee is in KRW.
 function positions(trades=state.trades){
  const map={},issues=[];
  [...trades].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0).forEach(t=>{
   const p=map[t.symbol]||(map[t.symbol]={symbol:t.symbol,currency:t.currency,qty:0,cost:0,costCcy:0,realized:0,last:t.price});
   const fx=t.currency==='USD'?t.fx:1;p.last=t.price;
   if(t.side==='buy'){p.qty+=t.qty;p.cost+=t.qty*t.price*fx+(t.fee||0);p.costCcy+=t.qty*t.price;}
   else{if(t.qty>p.qty+1e-9){issues.push(t);return;}const r=t.qty/p.qty,c=p.cost*r;p.realized+=t.qty*t.price*fx-(t.fee||0)-c;p.cost-=c;p.costCcy-=p.costCcy*r;p.qty-=t.qty;if(p.qty<1e-9){p.qty=0;p.cost=0;p.costCcy=0;}}
  });
  const list=Object.values(map).map(p=>{const q=state.prices[p.symbol],price=q?.price??p.last,fx=p.currency==='USD'?state.fx:1,value=p.qty*price*fx,profit=value-p.cost;
   return {...p,price,priceDate:q?.date,priced:!!q,avg:p.qty?p.costCcy/p.qty:0,value,profit,pct:p.cost?profit/p.cost*100:NaN};});
  return {list,issues};
 }
 function totals(list){const invested=list.reduce((a,p)=>a+p.cost,0),value=list.reduce((a,p)=>a+p.value,0),realized=list.reduce((a,p)=>a+p.realized,0);return {invested,value,profit:value-invested,pct:invested?(value-invested)/invested*100:NaN,realized};}
 window.diaryCosts=()=>Object.fromEntries(positions().list.filter(p=>p.qty>0).map(p=>[p.symbol,p.cost]));

 function status(msg,withUndo){$('dStatus').innerHTML=esc(msg)+(withUndo&&undo?' <button type="button" class="linkBtn" id="dUndoBtn">되돌리기</button>':'')+(storageOk?'':'<br><span class="error">이 브라우저에 저장하지 못했습니다. 백업 파일로 기록을 보관하세요.</span>');}
 function remember(label){undo={state:JSON.stringify(state),label};}
 $('dStatus').addEventListener('click',e=>{if(e.target.id==='dUndoBtn'&&undo){state=JSON.parse(undo.state);const l=undo.label;undo=null;save();draw();status(l+' 작업을 되돌렸습니다.');}});

 function drawPositions(){
  const {list}=positions(),held=list.filter(p=>p.qty>0),t=totals(list);
  $('dValue').textContent=compact(t.value);$('dInvested').textContent=compact(t.invested);
  $('dProfit').textContent=signed(t.profit);$('dProfit').className='big '+tone(t.profit);$('dPct').textContent='투자금액 대비 '+pctText(t.pct);
  $('dValueNote').textContent=held.length?`${held.length}개 종목 · 1달러 = ${won(state.fx)} 기준`:'매매 기록을 추가하면 계산됩니다';
  $('dRealized').textContent=t.realized?`실현 손익 ${signed(t.realized)} (매도 완료분, 위 금액에 미포함)`:'';
  $('dPositions').innerHTML=held.length?held.map(p=>`<tr><td><strong>${esc(nameOf(p.symbol))}</strong><small>${esc(p.symbol)} · ${p.currency==='USD'?'달러':'원화'}</small></td><td>${qtyText(p.qty)}</td><td>${ccyText(p.avg,p.currency)}</td><td>${won(p.cost)}</td><td><input type="number" class="priceInput" data-sym="${esc(p.symbol)}" value="${+p.price.toFixed(4)}" min="0" step="any" aria-label="${esc(nameOf(p.symbol))} 현재가"><small>${p.priced?esc(p.priceDate)+' 기준':'최근 매매가 · 현재가를 입력하세요'}</small></td><td>${won(p.value)}</td><td class="${tone(p.profit)}">${signed(p.profit)}</td><td class="${tone(p.profit)}">${pctText(p.pct)}</td></tr>`).join('')+`<tr class="total"><td>합계</td><td></td><td></td><td>${won(t.invested)}</td><td></td><td>${won(t.value)}</td><td class="${tone(t.profit)}">${signed(t.profit)}</td><td class="${tone(t.profit)}">${pctText(t.pct)}</td></tr>`
   :'<tr><td colspan="8" class="empty">아직 보유 종목이 없습니다. 아래 "매매 기록 추가"에서 첫 매수를 기록하세요.</td></tr>';
 }
 function drawTrades(){
  const rows=[...state.trades].sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  $('tRows').innerHTML=rows.length?rows.map(t=>{const krw=t.qty*t.price*(t.currency==='USD'?t.fx:1);return `<tr><td>${esc(t.date)}</td><td class="${t.side==='buy'?'up':'down'}">${t.side==='buy'?'매수':'매도'}</td><td>${esc(nameOf(t.symbol))}</td><td>${qtyText(t.qty)}</td><td>${ccyText(t.price,t.currency)}</td><td>${t.currency==='USD'?won(t.fx):'—'}</td><td>${won(krw)}${t.fee?`<small>수수료 ${won(t.fee)}</small>`:''}</td><td class="memo">${esc(t.memo)}</td><td><button type="button" class="remove" data-trade="${t.id}" aria-label="${esc(t.date)} ${esc(nameOf(t.symbol))} 기록 삭제">✕</button></td></tr>`}).join('')
   :'<tr><td colspan="9" class="empty">매매 기록이 없습니다.</td></tr>';
 }
 function drawJournal(){
  const es=[...state.entries].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.at-b.at);
  $('jList').innerHTML=es.length?[...es].reverse().map((e,i,arr)=>{const prev=arr[i+1],d=prev?e.value-prev.value:null;
   return `<article class="entry"><header><strong>${esc(e.date)}</strong><button type="button" class="remove" data-entry="${e.id}" aria-label="${esc(e.date)} 일지 삭제">✕</button></header><div class="entryNums"><span>투자금액 <b>${won(e.invested)}</b></span><span>평가금액 <b>${won(e.value)}</b></span><span>수익 <b class="${tone(e.profit)}">${signed(e.profit)} · ${pctText(e.pct)}</b></span>${d===null?'':`<span>직전 기록 대비 <b class="${tone(d)}">${signed(d)}</b></span>`}</div>${e.holdings?.length?`<p class="hint">${e.holdings.map(h=>esc(nameOf(h.symbol))+' '+won(h.value)+' ('+pctText(h.pct)+')').join(' · ')}</p>`:''}${e.note?`<p class="note">${esc(e.note)}</p>`:''}</article>`}).join('')
   :'<p class="empty">아직 일지가 없습니다. 위에서 오늘 현황을 기록하면 여기에 날짜별로 쌓입니다.</p>';
  const svg=$('jChart');if(es.length<2){svg.classList.add('hidden');return;}svg.classList.remove('hidden');
  const W=1000,H=240,L=90,R=22,T=18,B=36,max=Math.max(...es.flatMap(e=>[e.value,e.invested]))*1.1||1;
  const x=i=>L+i/(es.length-1)*(W-L-R),y=v=>H-B-v/max*(H-T-B);let s='';
  for(let i=0;i<=3;i++){const v=max*i/3;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#e8ece5"/><text x="${L-12}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#718077">${compact(v)}</text>`;}
  [0,es.length-1].forEach(i=>s+=`<text x="${x(i)}" y="${H-10}" text-anchor="${i?'end':'start'}" font-size="11" fill="#718077">${esc(es[i].date)}</text>`);
  [['invested','#c5ccc3'],['value','#2c6c50']].forEach(([k,c])=>{s+=`<polyline points="${es.map((e,i)=>x(i)+','+y(e[k])).join(' ')}" fill="none" stroke="${c}" stroke-width="3"/>`;const i=es.length-1;s+=`<circle cx="${x(i)}" cy="${y(es[i][k])}" r="5" fill="${c}"/>`;});
  svg.innerHTML=s;
 }
 function draw(){$('dFx').value=state.fx;drawPositions();drawTrades();drawJournal();}

 $('symbolList').innerHTML=presets.map(f=>`<option value="${f.id}">${esc(f.label)} · ${esc(f.name)}</option>`).join('');
 $('tDate').value=today();
 function syncTradeForm(){const p=preset($('tSymbol').value.trim().toUpperCase());if(p)$('tCurrency').value=p.route==='us'?'USD':'KRW';const usd=$('tCurrency').value==='USD';$('tFx').disabled=!usd;$('tFxWrap').classList.toggle('muted',!usd);$('tPriceLabel').textContent=usd?'단가 · 달러/주':'단가 · 원/주';if(usd&&!$('tFx').value)$('tFx').value=state.fx;}
 $('tSymbol').addEventListener('input',syncTradeForm);$('tCurrency').addEventListener('change',syncTradeForm);syncTradeForm();
 $('tradeForm').addEventListener('submit',e=>{e.preventDefault();$('tError').textContent='';if(!$('tradeForm').reportValidity())return;
  const symbol=$('tSymbol').value.trim().toUpperCase();
  if(!/^[A-Z0-9.\-]{1,12}$/.test(symbol)){$('tError').textContent='종목 코드는 영문·숫자로 입력하세요. 예: VOO, 360750';return;}
  const t={id:uid(),date:$('tDate').value,side:$('tSide').value,symbol,currency:$('tCurrency').value,qty:Number($('tQty').value),price:Number($('tPrice').value),fx:$('tCurrency').value==='USD'?Number($('tFx').value):1,fee:Number($('tFee').value)||0,memo:$('tMemo').value.trim()};
  const held=state.trades.find(x=>x.symbol===symbol);
  if(held&&held.currency!==t.currency){$('tError').textContent=`${symbol}은 이전 기록에서 ${held.currency==='USD'?'달러':'원화'}로 기록했습니다. 같은 통화로 입력하세요.`;return;}
  if(positions([...state.trades,t]).issues.length){$('tError').textContent='매도 수량이 그 날짜까지 보유한 수량보다 많습니다. 날짜와 수량을 확인하세요.';return;}
  remember('매매 기록 추가');state.trades.push(t);if(t.currency==='USD')state.fx=state.fx||t.fx;save();
  ['tQty','tPrice','tFee','tMemo'].forEach(k=>$(k).value='');draw();status(`${t.date} ${nameOf(symbol)} ${t.side==='buy'?'매수':'매도'} ${qtyText(t.qty)}를 기록했습니다.`,true);});
 $('tRows').addEventListener('click',e=>{const b=e.target.closest('[data-trade]');if(!b)return;const t=state.trades.find(x=>x.id===b.dataset.trade);
  if(positions(state.trades.filter(x=>x!==t)).issues.length){status('이 매수 기록을 지우면 이후 매도 수량이 보유 수량보다 많아집니다. 매도 기록을 먼저 지우세요.');return;}
  remember('매매 기록 삭제');state.trades=state.trades.filter(x=>x!==t);save();draw();status(`${t.date} ${nameOf(t.symbol)} 기록을 삭제했습니다.`,true);});
 $('dPositions').addEventListener('change',e=>{const sym=e.target.dataset.sym;if(!sym)return;const v=Number(e.target.value);if(!(v>0)){drawPositions();return;}state.prices[sym]={price:v,date:today()};save();drawPositions();status(`${nameOf(sym)} 현재가를 ${ccyText(v,positions().list.find(p=>p.symbol===sym).currency)}로 바꿨습니다.`);});
 $('dFx').addEventListener('change',()=>{const v=Number($('dFx').value);if(v>=100&&v<=10000){state.fx=v;save();drawPositions();}else $('dFx').value=state.fx;});
 $('dRefresh').onclick=async()=>{
  const usdHeld=positions().list.filter(p=>p.qty>0&&p.currency==='USD');
  if(!usdHeld.length){status('달러 종목이 없습니다. 원화 종목의 현재가는 표에서 직접 입력하세요.');return;}
  if(!window.marketQuote){status('시세 조회 기능을 불러오지 못했습니다. 현재가를 표에서 직접 입력하세요.');return;}
  $('dRefresh').disabled=true;status(usdHeld.map(p=>p.symbol).join('·')+' 현재가 조회 중…');const msgs=[];
  try{for(const p of usdHeld){try{const q=await window.marketQuote(p.symbol);state.prices[p.symbol]={price:q.price,date:q.tradingDay};msgs.push(`${p.symbol} ${usd(q.price)} (${q.tradingDay})`);}
   catch(err){msgs.push(`${p.symbol} 조회 실패 · ${err.message||'현재가를 직접 입력하세요.'}`);if(err.kind==='blocked'||err.kind==='input')break;}}
   save();drawPositions();status(msgs.join('\n')+'\n원화 종목의 현재가와 환율은 표에서 직접 입력하세요.');}
  finally{$('dRefresh').disabled=false;}
 };
 $('jSave').onclick=()=>{const {list}=positions(),held=list.filter(p=>p.qty>0);
  if(!held.length){status('기록할 보유 종목이 없습니다. 먼저 매매 기록을 추가하세요.');return;}
  const t=totals(list);remember('일지 기록');
  state.entries.push({id:uid(),date:today(),at:Date.now(),invested:t.invested,value:t.value,profit:t.profit,pct:t.pct,realized:t.realized,fx:state.fx,note:$('jNote').value.trim(),holdings:held.map(p=>({symbol:p.symbol,qty:p.qty,price:p.price,value:p.value,pct:p.pct}))});
  save();$('jNote').value='';drawJournal();status(`${today()} 현황을 일지에 남겼습니다.`,true);};
 $('jList').addEventListener('click',e=>{const b=e.target.closest('[data-entry]');if(!b)return;remember('일지 삭제');state.entries=state.entries.filter(x=>x.id!==b.dataset.entry);save();drawJournal();status('일지를 삭제했습니다.',true);});
 $('dExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({app:'chagok-diary',version:1,exportedAt:new Date().toISOString(),...state},null,1)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`chagok-diary-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('백업 파일을 내려받았습니다. 휴대폰·다른 PC에서는 "백업 불러오기"로 옮길 수 있습니다.');};
 $('dImport').addEventListener('change',async()=>{const f=$('dImport').files[0];$('dImport').value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!Array.isArray(d.trades)||!Array.isArray(d.entries))throw 0;
   remember('백업 불러오기');state={trades:d.trades,prices:d.prices||{},fx:Number(d.fx)||state.fx,entries:d.entries};save();draw();status(`백업을 불러왔습니다. 매매 ${state.trades.length}건 · 일지 ${state.entries.length}건`,true);}
  catch{status('차곡 다이어리 백업 파일이 아닙니다. 내려받은 .json 파일을 선택하세요.');}});
 draw();if(!storageOk)status('');
})();
