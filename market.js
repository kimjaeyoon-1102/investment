// Credentials remain in the password field in this tab; never persisted or logged.
(()=>{
 let busy=false,timer=null,lastProfile={};
 const show=msg=>{$('marketStatus').textContent=msg;$('resultMarketStatus').textContent=msg};
 async function refresh(automatic=false){
  if(busy)return;
  if(selected==='CUSTOM'){show('직접 설정 ETF는 자동 조회를 지원하지 않습니다.');return;}
  const key=$('apiKey').value.trim();
  if(!key){show('연결 안 됨 · 본인의 Alpha Vantage API 키를 입력하세요. 기존 가정은 유지됩니다.');return;}
  const symbol=selected,mode=$('quoteMode').value;
  const profile=!automatic||!lastProfile[symbol]||Date.now()-lastProfile[symbol]>86400000;
  busy=true;$('refreshMarket').disabled=true;show(`${symbol} 최신 데이터 조회 중… 기존 값으로 계속 계산할 수 있습니다.`);
  try{
   const res=await fetch('/api/market',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol,apiKey:key,mode,profile}),signal:AbortSignal.timeout(25000)});
   const data=await res.json();if(!res.ok||data.error)throw new Error(data.error||'조회 실패');
   if(selected!==symbol){show('선택 ETF가 바뀌어 이전 종목의 응답은 적용하지 않았습니다. 다시 조회하세요.');return;}
   const messages=[];
   if(data.quote){$('price').value=data.quote.price;messages.push(`시세 $${data.quote.price.toFixed(2)} · 거래일 ${data.quote.tradingDay} · ${mode==='eod'?'일별 종가':mode==='delayed'?'15분 지연 이용권 요청':'실시간 이용권 요청'}`);}
   if(data.profile){
    if(data.profile.yield!==null){$('yield').value=Number(data.profile.yield.toFixed(4));messages.push(`제공사 분배율 ${data.profile.yield.toFixed(4)}% 적용`);}
    if(data.profile.expense!==null){$('expense').value=Number(data.profile.expense.toFixed(4));messages.push(`운용보수 ${data.profile.expense.toFixed(4)}% 적용 · 기준 보수 ${$('refExpense').value}% 대비 차이 반영`);}
    if(data.profile.yield!==null&&data.profile.expense!==null)lastProfile[symbol]=Date.now();
   }
   messages.push(...(data.errors||[]));messages.push(`조회 시각 ${new Date(data.retrievedAt).toLocaleString('ko-KR')} · 지표 기준일은 제공되지 않음`);
   show(messages.join('\n'));window.recalculateMarket();
  }catch{show('조회 실패 · API 키, 이용권 또는 조회 한도를 확인하세요. 기존 입력값은 유지됩니다.');if(automatic){clearInterval(timer);timer=null;$('autoRefresh').value='off';}}
  finally{busy=false;$('refreshMarket').disabled=false;}
 }
 function schedule(){if(timer)clearInterval(timer);timer=null;if($('autoRefresh').value==='on'){
  if($('quoteMode').value==='eod'){$('autoRefresh').value='off';show('일별 종가 모드에서는 5분 자동 갱신을 사용하지 않습니다. 필요할 때 수동 조회하세요.');return;}
  if(!$('apiKey').value.trim()){$('autoRefresh').value='off';show('자동 갱신을 켜려면 API 키를 먼저 입력하세요.');return;}
  refresh();timer=setInterval(()=>{if(!document.hidden)refresh(true)},300000);
 }}
 $('refreshMarket').onclick=()=>refresh();$('autoRefresh').onchange=schedule;$('quoteMode').onchange=schedule;
 window.addEventListener('fundchange',()=>{show('종목 변경 · 초기 데이터와 계획 가정을 사용합니다. 최신 데이터를 적용하려면 조회하세요.');if($('autoRefresh').value==='on')refresh();});
})();
