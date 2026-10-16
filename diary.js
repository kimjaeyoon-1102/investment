// Investment diary: trades, current prices and dated snapshots, kept in this browser's localStorage.
(()=>{
 const store='chagok-diary-v1';
 const blank=()=>({trades:[],prices:{},marks:{},fx:Number($('fx').value)||1400,entries:[]});
 // Trades record the amount paid or received; quantity is optional. Older backups stored quantity and unit price.
 const normalize=d=>({...blank(),...d,marks:d.marks||{},trades:(d.trades||[]).map((t,i)=>({...t,amount:Number(t.amount??t.qty*t.price)||0,qty:t.qty>0?Number(t.qty):null,created:t.created??i}))});
 let state=blank(),undo=null,storageOk=true;
 try{const saved=JSON.parse(localStorage.getItem(store));if(saved&&Array.isArray(saved.trades))state=normalize(saved);}catch{}
 function save(){try{localStorage.setItem(store,JSON.stringify(state));storageOk=true;}catch{storageOk=false;}}
 const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
 const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const presets=funds.filter(f=>f.id!=='CUSTOM');
 const preset=sym=>presets.find(f=>f.id===sym);
 const nameOf=sym=>preset(sym)?.label||sym;
 const qtyText=q=>(+q.toFixed(6)).toLocaleString('ko-KR',{maximumFractionDigits:6})+'주';
 const ccyText=(n,c)=>c==='USD'?usd(n):won(n);
 const curOf=c=>c==='USD'?'$':'₩';
 const fmt=n=>displayCcy==='USD'?usd(n):won(n);
 const signed=n=>(n>0?'+':n<0?'−':'')+fmt(Math.abs(n));
 const bigFmt=n=>displayCcy==='USD'?usdWhole(n):compact(n);
 const pctText=n=>Number.isFinite(n)?(n>0?'+':n<0?'−':'')+Math.abs(n).toFixed(2)+'%':'—';
 const tone=n=>n>0?'up':n<0?'down':'';
 const byTime=(a,b)=>a.date<b.date?-1:a.date>b.date?1:a.created-b.created;

 // Average-cost positions. A USD trade converts at the rate recorded with it; the fee is in KRW.
 // With every trade's quantity known, value = quantity × current price. Otherwise value is the last
 // amount the user entered (a "mark"), adjusted by money bought or sold since, or the cost if never marked.
 function positions(trades=state.trades){
  const map={},issues=[];
  [...trades].sort(byTime).forEach(t=>{
   const p=map[t.symbol]||(map[t.symbol]={symbol:t.symbol,currency:t.currency,qty:0,qtyKnown:true,cost:0,costCcy:0,costUsd:0,realized:0,realizedUsd:0,lastUnit:null});
   const us=t.currency==='USD',fx=us?t.fx:1,fee=t.fee||0;
   if(t.side==='buy'){p.cost+=t.amount*fx+fee;p.costCcy+=t.amount;if(us)p.costUsd+=t.amount+fee/fx;if(t.qty){p.qty+=t.qty;p.lastUnit=t.amount/t.qty;}else p.qtyKnown=false;return;}
   if(p.costCcy<=1e-9){issues.push(t);return;}
   let r;
   if(p.qtyKnown&&t.qty){if(t.qty>p.qty+1e-9){issues.push(t);return;}r=t.qty/p.qty;p.qty-=t.qty;p.lastUnit=t.amount/t.qty;}
   else{r=t.ratio;if(!(r>0&&r<=1+1e-9)){issues.push(t);return;}p.qtyKnown=false;}
   const c=p.cost*r,cu=p.costUsd*r;p.realized+=t.amount*fx-fee-c;if(us)p.realizedUsd+=t.amount-fee/fx-cu;
   p.cost-=c;p.costCcy-=p.costCcy*r;p.costUsd-=cu;
   if(r>=1-1e-9)Object.assign(p,{qty:0,qtyKnown:true,cost:0,costCcy:0,costUsd:0,lastUnit:null});
  });
  // In dollars, a US holding uses its real dollar cost and value, so its return leaves out the exchange-rate effect; a KRW holding converts at the current rate.
  const dollars=displayCcy==='USD';
  const list=Object.values(map).map(p=>{
   const us=p.currency==='USD',byQty=p.qtyKnown&&p.qty>0,q=state.prices[p.symbol],m=state.marks[p.symbol];
   const price=byQty?(q?.price??p.lastUnit):null;
   const valueCcy=Math.max(0,byQty?p.qty*price:m?m.value+trades.filter(t=>t.symbol===p.symbol&&t.created>m.at).reduce((a,t)=>a+(t.side==='buy'?t.amount:-t.amount),0):p.costCcy);
   const valueKrw=valueCcy*(us?state.fx:1);
   const cost=dollars?(us?p.costUsd:p.cost/state.fx):p.cost,value=dollars?(us?valueCcy:valueKrw/state.fx):valueKrw,realized=dollars?(us?p.realizedUsd:p.realized/state.fx):p.realized,profit=value-cost;
   return {...p,held:p.costCcy>1e-9,byQty,costKrw:p.cost,valueCcy,valueKrw,cost,value,realized,price,priceDate:q?.date,priced:!!q,mark:m,profit,pct:cost?profit/cost*100:NaN};});
  return {list,issues};
 }
 function totals(list){const invested=list.reduce((a,p)=>a+p.cost,0),value=list.reduce((a,p)=>a+p.value,0),realized=list.reduce((a,p)=>a+p.realized,0);return {invested,value,profit:value-invested,pct:invested?(value-invested)/invested*100:NaN,realized};}
 window.diaryCosts=()=>Object.fromEntries(positions().list.filter(p=>p.held).map(p=>[p.symbol,p.costKrw]));

 function status(msg,withUndo){$('dStatus').innerHTML=esc(msg)+(withUndo&&undo?' <button type="button" class="linkBtn" id="dUndoBtn">되돌리기</button>':'')+(storageOk?'':'<br><span class="error">이 브라우저에 저장하지 못했습니다. 백업 파일로 기록을 보관하세요.</span>');}
 function remember(label){undo={state:JSON.stringify(state),label};}
 $('dStatus').addEventListener('click',e=>{if(e.target.id==='dUndoBtn'&&undo){state=JSON.parse(undo.state);const l=undo.label;undo=null;save();draw();status(l+' 작업을 되돌렸습니다.');}});

 function drawPositions(){
  const {list}=positions(),held=list.filter(p=>p.held),t=totals(list);
  $('dValue').textContent=bigFmt(t.value);$('dInvested').textContent=bigFmt(t.invested);
  $('dProfit').textContent=signed(t.profit);$('dProfit').className='big '+tone(t.profit);$('dPct').textContent='투자금액 대비 '+pctText(t.pct);
  $('dValueNote').textContent=held.length?`${held.length}개 종목 · 1달러 = ${won(state.fx)} 기준`+(displayCcy==='USD'?' · 달러 종목은 실제 달러 기준':''):'매매 기록을 추가하면 계산됩니다';
  $('dRealized').textContent=t.realized?`실현 손익 ${signed(t.realized)} (매도 완료분, 위 금액에 미포함)`:'';
  const box=(cls,p,val,label)=>`<div class="money sm"><span class="cur" aria-hidden="true">${curOf(p.currency)}</span><input type="number" class="${cls}" data-sym="${esc(p.symbol)}" value="${val}" min="0" step="any" aria-label="${esc(label)}"></div>`;
  $('dPositions').innerHTML=held.length?held.map(p=>{
   const priceCell=p.byQty?box('priceInput',p,+p.price.toFixed(4),nameOf(p.symbol)+' 현재가')+`<small>${p.priced?esc(p.priceDate)+' 기준':'최근 매매가 · 현재가를 입력하세요'}</small>`:'<span class="hint">—</span>';
   const valueCell=p.byQty?fmt(p.value):box('valueInput',p,+p.valueCcy.toFixed(p.currency==='USD'?2:0),nameOf(p.symbol)+' 현재 평가금액')+`<small>${p.mark?esc(p.mark.date)+' 입력 · 이후 매매 반영':'증권사 앱의 평가금액을 입력하세요'}</small>`+(displayCcy==='USD'&&p.currency!=='USD'||displayCcy!=='USD'&&p.currency==='USD'?`<small>${fmt(p.value)}</small>`:'');
   return `<tr><td><strong>${esc(nameOf(p.symbol))}</strong><small>${esc(p.symbol)} · ${p.currency==='USD'?'달러':'원화'}${p.byQty?' · '+qtyText(p.qty):''}</small></td><td>${fmt(p.cost)}</td><td>${priceCell}</td><td>${valueCell}</td><td class="${tone(p.profit)}">${signed(p.profit)}</td><td class="${tone(p.profit)}">${pctText(p.pct)}</td></tr>`;}).join('')+`<tr class="total"><td>합계</td><td>${fmt(t.invested)}</td><td></td><td>${fmt(t.value)}</td><td class="${tone(t.profit)}">${signed(t.profit)}</td><td class="${tone(t.profit)}">${pctText(t.pct)}</td></tr>`
   :'<tr><td colspan="6" class="empty">아직 보유 종목이 없습니다. 아래 "매매 기록 추가"에서 첫 매수를 기록하세요.</td></tr>';
 }
 function drawTrades(){
  const rows=[...state.trades].sort(byTime).reverse();
  $('tRows').innerHTML=rows.length?rows.map(t=>{const us=t.currency==='USD',krw=t.amount*(us?t.fx:1),shown=displayCcy==='USD'?(us?t.amount:krw/state.fx):krw,same=(displayCcy==='USD')===us;
   return `<tr><td>${esc(t.date)}</td><td class="${t.side==='buy'?'up':'down'}">${t.side==='buy'?'매수':'매도'}</td><td>${esc(nameOf(t.symbol))}</td><td>${ccyText(t.amount,t.currency)}${same?'':`<small>${fmt(shown)}</small>`}${t.fee?`<small>수수료 ${displayCcy==='USD'?usd(t.fee/(us?t.fx:state.fx)):won(t.fee)}</small>`:''}</td><td>${t.qty?qtyText(t.qty):'—'}</td><td>${us?won(t.fx):'—'}</td><td class="memo">${esc(t.memo)}</td><td><button type="button" class="remove" data-trade="${t.id}" aria-label="${esc(t.date)} ${esc(nameOf(t.symbol))} 기록 삭제">✕</button></td></tr>`}).join('')
   :'<tr><td colspan="8" class="empty">매매 기록이 없습니다.</td></tr>';
 }
 function drawJournal(){
  // Entries saved before the currency toggle hold KRW only; convert those at the rate recorded with them.
  const dollars=displayCcy==='USD',es=[...state.entries].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.at-b.at).map(e=>dollars?{...e,invested:e.investedUsd??e.invested/e.fx,value:e.valueUsd??e.value/e.fx,profit:e.profitUsd??e.profit/e.fx,pct:e.pctUsd??e.pct,holdings:(e.holdings||[]).map(h=>({...h,value:h.valueUsd??h.value/e.fx,pct:h.pctUsd??h.pct}))}:e);
  $('jList').innerHTML=es.length?[...es].reverse().map((e,i,arr)=>{const prev=arr[i+1],d=prev?e.value-prev.value:null;
   return `<article class="entry"><header><strong>${esc(e.date)}</strong><button type="button" class="remove" data-entry="${e.id}" aria-label="${esc(e.date)} 일지 삭제">✕</button></header><div class="entryNums"><span>투자금액 <b>${fmt(e.invested)}</b></span><span>평가금액 <b>${fmt(e.value)}</b></span><span>수익 <b class="${tone(e.profit)}">${signed(e.profit)} · ${pctText(e.pct)}</b></span>${d===null?'':`<span>직전 기록 대비 <b class="${tone(d)}">${signed(d)}</b></span>`}</div>${e.holdings?.length?`<p class="hint">${e.holdings.map(h=>esc(nameOf(h.symbol))+' '+fmt(h.value)+' ('+pctText(h.pct)+')').join(' · ')}</p>`:''}${e.note?`<p class="note">${esc(e.note)}</p>`:''}</article>`}).join('')
   :'<p class="empty">아직 일지가 없습니다. 위에서 오늘 현황을 기록하면 여기에 날짜별로 쌓입니다.</p>';
  const svg=$('jChart');if(es.length<2){svg.classList.add('hidden');return;}svg.classList.remove('hidden');
  const W=1000,H=240,L=90,R=22,T=18,B=36,max=Math.max(...es.flatMap(e=>[e.value,e.invested]))*1.1||1;
  const x=i=>L+i/(es.length-1)*(W-L-R),y=v=>H-B-v/max*(H-T-B);let s='';
  for(let i=0;i<=3;i++){const v=max*i/3;s+=`<line x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="#e8ece5"/><text x="${L-12}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="#718077">${bigFmt(v)}</text>`;}
  [0,es.length-1].forEach(i=>s+=`<text x="${x(i)}" y="${H-10}" text-anchor="${i?'end':'start'}" font-size="11" fill="#718077">${esc(es[i].date)}</text>`);
  [['invested','#c5ccc3'],['value','#2c6c50']].forEach(([k,c])=>{s+=`<polyline points="${es.map((e,i)=>x(i)+','+y(e[k])).join(' ')}" fill="none" stroke="${c}" stroke-width="3"/>`;const i=es.length-1;s+=`<circle cx="${x(i)}" cy="${y(es[i][k])}" r="5" fill="${c}"/>`;});
  svg.innerHTML=s;
 }
 function draw(){$('dFx').value=state.fx;drawPositions();drawTrades();drawJournal();}

 $('symbolList').innerHTML=presets.map(f=>`<option value="${f.id}">${esc(f.label)} · ${esc(f.name)}</option>`).join('');
 $('tDate').value=today();
 function syncTradeForm(){const p=preset($('tSymbol').value.trim().toUpperCase());if(p)$('tCurrency').value=p.route==='us'?'USD':'KRW';const usd=$('tCurrency').value==='USD';$('tFx').disabled=!usd;$('tFxWrap').classList.toggle('muted',!usd);$('tAmountLabel').textContent=($('tSide').value==='buy'?'구매 금액':'매도 금액')+(usd?' · 달러':' · 원');$('tAmountCur').textContent=usd?'$':'₩';if(usd&&!$('tFx').value)$('tFx').value=state.fx;}
 $('tSymbol').addEventListener('input',syncTradeForm);$('tCurrency').addEventListener('change',syncTradeForm);$('tSide').addEventListener('change',syncTradeForm);syncTradeForm();
 $('tradeForm').addEventListener('submit',e=>{e.preventDefault();$('tError').textContent='';if(!$('tradeForm').reportValidity())return;
  const symbol=$('tSymbol').value.trim().toUpperCase();
  if(!/^[A-Z0-9.\-]{1,12}$/.test(symbol)){$('tError').textContent='종목 코드는 영문·숫자로 입력하세요. 예: VOO, 360750';return;}
  const usdTrade=$('tCurrency').value==='USD',qty=Number($('tQty').value)||null;
  const t={id:uid(),created:Date.now(),date:$('tDate').value,side:$('tSide').value,symbol,currency:$('tCurrency').value,amount:Number($('tAmount').value),qty,fx:usdTrade?Number($('tFx').value):1,fee:(Number($('tFee').value)||0)*(displayCcy==='USD'?(usdTrade?Number($('tFx').value):state.fx):1),memo:$('tMemo').value.trim()};
  const held=state.trades.find(x=>x.symbol===symbol);
  if(held&&held.currency!==t.currency){$('tError').textContent=`${symbol}은 이전 기록에서 ${held.currency==='USD'?'달러':'원화'}로 기록했습니다. 같은 통화로 입력하세요.`;return;}
  let mark=null;
  if(t.side==='sell'){const p=positions().list.find(x=>x.symbol===symbol&&x.held);
   if(!p){$('tError').textContent='이 종목은 보유 기록이 없어 매도할 수 없습니다.';return;}
   if(!(p.byQty&&qty)){
    // Without a quantity, the share of the holding sold is the amount over its current value; keep that value as the mark.
    if(t.amount>p.valueCcy*(1+1e-6)){$('tError').textContent=`매도 금액이 현재 평가금액(${ccyText(p.valueCcy,p.currency)})보다 큽니다. 표에서 평가금액을 먼저 고치거나 수량을 함께 입력하세요.`;return;}
    t.ratio=t.amount/p.valueCcy;mark={value:p.valueCcy,date:today(),at:t.created-1};
   }}
  if(positions([...state.trades,t]).issues.length){$('tError').textContent='매도 수량이 그 날짜까지 보유한 수량보다 많습니다. 날짜와 수량을 확인하세요.';return;}
  remember('매매 기록 추가');if(mark)state.marks[symbol]=mark;state.trades.push(t);save();
  ['tQty','tAmount','tFee','tMemo'].forEach(k=>$(k).value='');draw();status(`${t.date} ${nameOf(symbol)} ${t.side==='buy'?'매수':'매도'} ${ccyText(t.amount,t.currency)}를 기록했습니다.`,true);});
 $('tRows').addEventListener('click',e=>{const b=e.target.closest('[data-trade]');if(!b)return;const t=state.trades.find(x=>x.id===b.dataset.trade);
  if(positions(state.trades.filter(x=>x!==t)).issues.length){status('이 매수 기록을 지우면 이후 매도 기록과 맞지 않습니다. 매도 기록을 먼저 지우세요.');return;}
  remember('매매 기록 삭제');state.trades=state.trades.filter(x=>x!==t);save();draw();status(`${t.date} ${nameOf(t.symbol)} 기록을 삭제했습니다.`,true);});
 $('dPositions').addEventListener('change',e=>{const sym=e.target.dataset.sym;if(!sym)return;const v=Number(e.target.value),c=positions().list.find(p=>p.symbol===sym).currency;
  if(e.target.classList.contains('valueInput')){if(!(v>=0)){drawPositions();return;}state.marks[sym]={value:v,date:today(),at:Date.now()};save();drawPositions();status(`${nameOf(sym)} 평가금액을 ${ccyText(v,c)}로 바꿨습니다.`);return;}
  if(!(v>0)){drawPositions();return;}state.prices[sym]={price:v,date:today()};save();drawPositions();status(`${nameOf(sym)} 현재가를 ${ccyText(v,c)}로 바꿨습니다.`);});
 $('dFx').addEventListener('change',()=>{const v=Number($('dFx').value);if(v>=100&&v<=10000){state.fx=v;save();drawPositions();}else $('dFx').value=state.fx;});
 $('dRefresh').onclick=async()=>{
  const usdHeld=positions().list.filter(p=>p.byQty&&p.currency==='USD');
  if(!usdHeld.length){status('시세로 계산할 종목이 없습니다. 수량까지 기록한 달러 종목만 조회합니다. 금액으로만 기록한 종목은 표의 평가금액을 직접 고쳐 주세요.');return;}
  if(!window.marketQuote){status('시세 조회 기능을 불러오지 못했습니다. 현재가를 표에서 직접 입력하세요.');return;}
  $('dRefresh').disabled=true;status(usdHeld.map(p=>p.symbol).join('·')+' 현재가 조회 중…');const msgs=[];
  try{for(const p of usdHeld){try{const q=await window.marketQuote(p.symbol);state.prices[p.symbol]={price:q.price,date:q.tradingDay};msgs.push(`${p.symbol} ${usd(q.price)} (${q.tradingDay})`);}
   catch(err){msgs.push(`${p.symbol} 조회 실패 · ${err.message||'현재가를 직접 입력하세요.'}`);if(err.kind==='blocked'||err.kind==='input')break;}}
   save();drawPositions();status(msgs.join('\n')+'\n원화 종목과 금액으로만 기록한 종목은 표에서 직접 고쳐 주세요.');}
  finally{$('dRefresh').disabled=false;}
 };
 $('jSave').onclick=()=>{const {list}=positions(),held=list.filter(p=>p.held);
  if(!held.length){status('기록할 보유 종목이 없습니다. 먼저 매매 기록을 추가하세요.');return;}
  const t=totals(list);remember('일지 기록');
  const other=(()=>{const keep=displayCcy;displayCcy=keep==='USD'?'KRW':'USD';const o=totals(positions().list);const oh=positions().list.filter(p=>p.held);displayCcy=keep;return {t:o,h:oh};})();
  const [k,u,kh,uh]=displayCcy==='USD'?[other.t,t,other.h,held]:[t,other.t,held,other.h];
  state.entries.push({id:uid(),date:today(),at:Date.now(),invested:k.invested,value:k.value,profit:k.profit,pct:k.pct,realized:k.realized,investedUsd:u.invested,valueUsd:u.value,profitUsd:u.profit,pctUsd:u.pct,fx:state.fx,note:$('jNote').value.trim(),holdings:kh.map((p,i)=>({symbol:p.symbol,qty:p.qty,price:p.price,value:p.value,pct:p.pct,valueUsd:uh[i].value,pctUsd:uh[i].pct}))});
  save();$('jNote').value='';drawJournal();status(`${today()} 현황을 일지에 남겼습니다.`,true);};
 $('jList').addEventListener('click',e=>{const b=e.target.closest('[data-entry]');if(!b)return;remember('일지 삭제');state.entries=state.entries.filter(x=>x.id!==b.dataset.entry);save();drawJournal();status('일지를 삭제했습니다.',true);});
 $('dExport').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({app:'chagok-diary',version:1,exportedAt:new Date().toISOString(),...state},null,1)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`chagok-diary-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('백업 파일을 내려받았습니다. 휴대폰·다른 PC에서는 "백업 불러오기"로 옮길 수 있습니다.');};
 $('dImport').addEventListener('change',async()=>{const f=$('dImport').files[0];$('dImport').value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!Array.isArray(d.trades)||!Array.isArray(d.entries))throw 0;
   remember('백업 불러오기');state=normalize({...d,fx:Number(d.fx)||state.fx});save();draw();status(`백업을 불러왔습니다. 매매 ${state.trades.length}건 · 일지 ${state.entries.length}건`,true);}
  catch{status('차곡 다이어리 백업 파일이 아닙니다. 내려받은 .json 파일을 선택하세요.');}});
 window.diaryRedraw=draw;
 draw();if(!storageOk)status('');
})();
