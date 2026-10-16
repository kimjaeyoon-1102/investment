// The API key stays in this tab unless the user opts in to keeping it in this browser's localStorage; never logged.
(()=>{
 const keyStore='chagok-av-key';
 try{const saved=localStorage.getItem(keyStore);if(saved){$('apiKey').value=saved;$('saveKey').checked=true;}}catch{}
 function persistKey(){try{const key=$('apiKey').value.trim();if($('saveKey').checked&&key)localStorage.setItem(keyStore,key);else if(!$('saveKey').checked)localStorage.removeItem(keyStore);}catch{}}
 $('saveKey').addEventListener('change',persistKey);$('apiKey').addEventListener('change',persistKey);
 const supported=new Set(['VOO','VTI','BND','QQQM']);
 let busy=false,timer=null,lastProfile={};
 const show=msg=>{$('marketStatus').textContent=msg;$('resultMarketStatus').textContent=msg};
 async function fetchOne(symbol,key,mode,automatic){
  const profile=!automatic||!lastProfile[symbol]||Date.now()-lastProfile[symbol]>86400000;
  const res=await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol,apiKey:key,mode,profile}),signal:AbortSignal.timeout(25000)});
  const data=await res.json();if(!res.ok||data.error)throw new Error(data.error||'조회 실패');
  const h=holdings.find(x=>x.id===symbol);
  if(!h)return [`${symbol} · 포트폴리오에서 빠져 응답을 적용하지 않았습니다.`];
  const messages=[];
  if(data.quote){h.price=data.quote.price;messages.push(`${symbol} 시세 $${data.quote.price.toFixed(2)} · 거래일 ${data.quote.tradingDay} · ${mode==='eod'?'일별 종가':mode==='delayed'?'15분 지연 이용권 요청':'실시간 이용권 요청'}`);}
  if(data.profile){
   if(data.profile.yield!==null){h.yield=Number(data.profile.yield.toFixed(4));messages.push(`${symbol} 제공사 분배율 ${data.profile.yield.toFixed(4)}% 적용`);}
   if(data.profile.expense!==null){h.expense=Number(data.profile.expense.toFixed(4));messages.push(`${symbol} 운용보수 ${data.profile.expense.toFixed(4)}% 적용 · 기준 보수 ${h.refExpense}% 대비 차이 반영`);}
   if(data.profile.yield!==null&&data.profile.expense!==null)lastProfile[symbol]=Date.now();
  }
  return messages.concat((data.errors||[]).map(e=>`${symbol} · ${e}`));
 }
 async function refresh(automatic=false){
  if(busy)return;
  const symbols=holdings.map(h=>h.id).filter(id=>supported.has(id));
  const skipped=holdings.map(h=>fund(h.id).label).filter((_,i)=>!supported.has(holdings[i].id));
  if(!symbols.length){show('미국 상장 ETF(VOO·VTI·BND·QQQM)만 자동 조회를 지원합니다. 국내·직접 설정 ETF는 입력값을 사용합니다.');return;}
  const key=$('apiKey').value.trim();
  if(!key){show('연결 안 됨 · 본인의 Alpha Vantage API 키를 입력하세요. 기존 가정은 유지됩니다.');return;}
  const mode=$('quoteMode').value;
  busy=true;$('refreshMarket').disabled=true;show(`${symbols.join('·')} 최신 데이터 조회 중… 기존 값으로 계속 계산할 수 있습니다.`);
  const messages=[];let failed=0;
  try{
   for(const symbol of symbols){
    try{messages.push(...await fetchOne(symbol,key,mode,automatic));}
    catch{failed++;messages.push(`${symbol} 조회 실패 · API 키, 이용권 또는 조회 한도를 확인하세요. 기존 입력값은 유지됩니다.`);}
   }
   if(skipped.length)messages.push(`${skipped.join('·')}: 자동 조회 미지원 · 입력값 유지`);
   messages.push(`조회 시각 ${new Date().toLocaleString('ko-KR')} · 지표 기준일은 제공되지 않음`);
   show(messages.join('\n'));window.recalculateMarket();
   if(automatic&&failed===symbols.length){clearInterval(timer);timer=null;$('autoRefresh').value='off';}
  }finally{busy=false;$('refreshMarket').disabled=false;}
 }
 function schedule(){if(timer)clearInterval(timer);timer=null;if($('autoRefresh').value==='on'){
  if($('quoteMode').value==='eod'){$('autoRefresh').value='off';show('일별 종가 모드에서는 5분 자동 갱신을 사용하지 않습니다. 필요할 때 수동 조회하세요.');return;}
  if(!$('apiKey').value.trim()){$('autoRefresh').value='off';show('자동 갱신을 켜려면 API 키를 먼저 입력하세요.');return;}
  refresh();timer=setInterval(()=>{if(!document.hidden)refresh(true)},300000);
 }}
 $('refreshMarket').onclick=()=>refresh();$('autoRefresh').onchange=schedule;$('quoteMode').onchange=schedule;
 window.addEventListener('fundchange',()=>{show('구성 변경 · 초기 데이터와 계획 가정을 사용합니다. 최신 데이터를 적용하려면 조회하세요.');if($('autoRefresh').value==='on')refresh();});
})();
