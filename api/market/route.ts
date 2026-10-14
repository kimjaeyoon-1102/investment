const allowed=new Set(['VOO','VTI','BND','QQQM']);
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
 try{
  const body=await request.json();
  if(!allowed.has(body.symbol)||typeof body.apiKey!=='string'||body.apiKey.length<5||body.apiKey.length>128||!/^[a-zA-Z0-9]+$/.test(body.apiKey))return Response.json({error:'지원 종목과 API 키를 확인해 주세요.'},{status:400,headers});
  if(!['eod','realtime','delayed'].includes(body.mode))return Response.json({error:'시세 모드를 확인해 주세요.'},{status:400,headers});
  async function query(fn:string){
   const url=new URL('https://www.alphavantage.co/query');url.searchParams.set('function',fn);url.searchParams.set('symbol',body.symbol);url.searchParams.set('apikey',body.apiKey);
   if(fn==='GLOBAL_QUOTE'&&body.mode!=='eod')url.searchParams.set('entitlement',body.mode);
   const res=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
   if(!res.ok)throw new Error('provider');const data=await res.json() as Record<string,any>;
   if(data.Note||data.Information||data['Error Message'])throw new Error('entitlement');return data;
  }
  const jobs=[query('GLOBAL_QUOTE')];if(body.profile===true)jobs.push(query('ETF_PROFILE'));
  const results=await Promise.allSettled(jobs);const out:Record<string,any>={symbol:body.symbol,mode:body.mode,retrievedAt:new Date().toISOString(),errors:[]};
  if(results[0].status==='fulfilled'){
   const quote=results[0].value['Global Quote'];const price=Number(quote?.['05. price']);
   if(quote?.['01. symbol']===body.symbol&&Number.isFinite(price)&&price>0&&/^\d{4}-\d{2}-\d{2}$/.test(quote?.['07. latest trading day']||''))out.quote={price,tradingDay:quote['07. latest trading day']};else out.errors.push('시세 데이터가 없거나 형식이 올바르지 않습니다.');
  }else out.errors.push('시세 조회 실패: 키·조회 한도·실시간 이용권을 확인하세요.');
  if(body.profile===true){
   const item=results[1];if(item.status==='fulfilled'){
    const data=item.value;const ratio=(v:any,max:number)=>v!==null&&v!==''&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=max?Number(v)*100:null;
    out.profile={expense:ratio(data.net_expense_ratio,.05),yield:ratio(data.dividend_yield,.2)};
    if(out.profile.expense===null||out.profile.yield===null)out.errors.push('운용보수 또는 분배율이 제공되지 않아 해당 입력값을 유지합니다.');
   }else out.errors.push('ETF 지표 조회 실패: 키·조회 한도·데이터 이용권을 확인하세요.');
  }
  return Response.json(out,{headers});
 }catch{return Response.json({error:'데이터를 불러오지 못했습니다. 기존 입력값을 유지합니다.'},{status:502,headers});}
}
