// The API key stays in this tab unless the user opts in to keeping it in this browser's localStorage; never logged.
(()=>{
 const keyStore='chagok-av-key';
 try{const saved=localStorage.getItem(keyStore);if(saved){$('apiKey').value=saved;$('saveKey').checked=true;}}catch{}
 function persistKey(){try{const key=$('apiKey').value.trim();if($('saveKey').checked&&key)localStorage.setItem(keyStore,key);else if(!$('saveKey').checked)localStorage.removeItem(keyStore);}catch{}}
 $('saveKey').addEventListener('change',persistKey);$('apiKey').addEventListener('change',persistKey);
 const supported=new Set(['VOO','VTI','BND','QQQM']);
 let busy=false,timer=null,lastProfile={};
 const show=msg=>{$('marketStatus').textContent=msg;$('resultMarketStatus').textContent=msg};
 const fail=(kind,msg)=>Object.assign(new Error(msg),{kind});
 // Same request and response shape as /api/market, for pages served without that route (a file opened locally, a static host).
 async function direct(symbol,key,mode,profile){
  if(!/^[a-zA-Z0-9]{5,128}$/.test(key))throw fail('input','API 키 형식이 올바르지 않습니다. 영문·숫자만 붙여넣었는지 확인하세요.');
  async function query(fn){
   const url=new URL('https://www.alphavantage.co/query');url.searchParams.set('function',fn);url.searchParams.set('symbol',symbol);url.searchParams.set('apikey',key);
   if(fn==='GLOBAL_QUOTE'&&mode!=='eod')url.searchParams.set('entitlement',mode);
   let res;try{res=await fetch(url,{signal:AbortSignal.timeout(15000)});}catch{throw fail('blocked','');}
   if(!res.ok)throw fail('provider','Alpha Vantage 응답 오류 '+res.status);
   const data=await res.json();const note=data.Note||data.Information||data['Error Message'];
   if(note)throw fail('provider',/rate limit|requests per/i.test(note)?'오늘 또는 분당 조회 한도를 넘었습니다. 잠시 뒤 다시 시도하세요.':/premium|entitlement/i.test(note)?'이 기능은 유료 이용권이 필요합니다. 시세 이용권을 "일별 종가"로 바꿔 보세요.':/apikey|api key/i.test(note)?'API 키가 올바르지 않습니다.':'제공사 메시지: '+note.slice(0,160));
   return data;
  }
  const out={errors:[],retrievedAt:new Date().toISOString()};
  const [q,pr]=await Promise.allSettled([query('GLOBAL_QUOTE'),profile?query('ETF_PROFILE'):Promise.resolve(null)]);
  if(q.status==='rejected'&&q.reason.kind==='blocked')throw q.reason;
  if(q.status==='fulfilled'){const g=q.value['Global Quote'],price=Number(g?.['05. price']);if(g?.['01. symbol']===symbol&&Number.isFinite(price)&&price>0)out.quote={price,tradingDay:g['07. latest trading day']};else out.errors.push('시세 데이터가 없습니다. 종목 또는 이용권을 확인하세요.');}
  else out.errors.push('시세 조회 실패 · '+q.reason.message);
  if(profile){if(pr.status==='fulfilled'){const d=pr.value,ratio=(v,max)=>v!==null&&v!==''&&v!==undefined&&Number(v)>=0&&Number(v)<=max?Number(v)*100:null;out.profile={expense:ratio(d.net_expense_ratio,.05),yield:ratio(d.dividend_yield,.2)};if(out.profile.expense===null||out.profile.yield===null)out.errors.push('운용보수 또는 분배율이 제공되지 않아 해당 입력값을 유지합니다.');}else out.errors.push('ETF 지표 조회 실패 · '+pr.reason.message);}
  return out;
 }
 async function viaServer(symbol,key,mode,profile){
  let res;try{res=await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol,apiKey:key,mode,profile}),signal:AbortSignal.timeout(25000)});}catch{return null;}
  let data;try{data=await res.json();}catch{return null;}
  if(res.status===400)throw fail('input',data.error||'API 키 형식을 확인하세요.');
  if(!res.ok||data.error)throw fail('provider',data.error||'조회 실패');
  return data;
 }
 // Quote only, for the diary. The site route accepts only the planner's US presets, so other symbols go direct.
 window.marketQuote=async symbol=>{
  const key=$('apiKey').value.trim();if(!key)throw fail('input','API 키가 없습니다. 1단계 "최신 데이터 연결"에서 키를 입력하고 저장해 두세요.');
  const mode=$('quoteMode').value,data=(supported.has(symbol)?await viaServer(symbol,key,mode,false):null)??await direct(symbol,key,mode,false);
  if(!data.quote)throw fail('provider',(data.errors||[])[0]||'시세 데이터가 없습니다.');return data.quote;
 };
 async function fetchOne(symbol,key,mode,automatic){
  const profile=!automatic||!lastProfile[symbol]||Date.now()-lastProfile[symbol]>86400000;
  const data=await viaServer(symbol,key,mode,profile)??await direct(symbol,key,mode,profile);
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
    catch(e){failed++;if(e.kind==='blocked'){messages.push('시세 서버에 연결하지 못했습니다. 이 페이지에서는 외부 조회가 막혀 있을 수 있습니다(claude.ai 링크 등). 원래 사이트나 내 컴퓨터에 받은 파일에서 조회하세요. 기존 입력값은 유지됩니다.');break;}messages.push(`${symbol} 조회 실패 · ${e.message||'API 키, 이용권 또는 조회 한도를 확인하세요.'} 기존 입력값은 유지됩니다.`);if(e.kind==='input')break;}
   }
   if(skipped.length)messages.push(`${skipped.join('·')}: 자동 조회 미지원 · 입력값 유지`);
   messages.push(`조회 시각 ${new Date().toLocaleString('ko-KR')} · 지표 기준일은 제공되지 않음`);
   show(messages.join('\n'));window.recalculateMarket();
   if(automatic&&failed){clearInterval(timer);timer=null;$('autoRefresh').value='off';}
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
