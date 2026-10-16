(function(root){
function simulate(p){
 const months=Math.round(p.years*12),b=p.broker/100,f=p.route==='us'?p.fxFee/100:0,t=p.divTax/100;
 const effectiveRate=(1+p.rate/100)*(1-(p.expense??0)/100)/(1-(p.refExpense??0)/100)-1;
 const q=Math.pow(1+effectiveRate,1/12)-1,pGrowth=q-p.yield/1200,fxGrowth=p.route==='us'?Math.pow(1+p.fxChange/100,1/12):1;
 let units=0,price=p.price,fx=p.route==='us'?p.fx:1,basis=0,principal=0,buyFees=0,exchangeFees=0,divTaxes=0,dividends=0,rows=[];
 // Money already invested is held from month 0 at cost: its value starts equal to what was paid and no new purchase costs apply.
 const initial=Math.max(0,p.initial||0);if(initial){units=initial/(price*fx);basis=initial;principal=initial;}
 for(let m=1;m<=months;m++){
  const prev=units*price*fx;
  fx*=fxGrowth;
  const dividend=units*price*p.yield/1200*fx;
  price*=1+pGrowth;
  const dt=dividend*t, reinvest=dividend-dt;
  const reinvestFee=reinvest*b/(1+b);
  units+=(reinvest-reinvestFee)/(price*fx);basis+=reinvest;
  const exchange=p.monthly*f, cash=p.monthly-exchange,fee=cash*b/(1+b);
  units+=(cash-fee)/(price*fx);basis+=cash;principal+=p.monthly;
  buyFees+=fee+reinvestFee;exchangeFees+=exchange;divTaxes+=dt;dividends+=dividend;
  const value=units*price*fx,sellFee=value*b,exitFx=(value-sellFee)*f;
  const gain=value-sellFee-basis;
  const tax=p.route==='us'?Math.max(0,gain-p.allowance)*.22:p.route==='krOther'?Math.max(0,gain)*p.taxRatio/100*.154:0;
  const net=value-sellFee-exitFx-tax;
  rows.push({m,principal,value,gain,profit:value-principal,monthlyProfit:value-prev-p.monthly,dividend,dt,net,netProfit:net-principal,tax,sellFee,exitFx,buyFees,exchangeFees,divTaxes,dividends,price,fx,units,basis});
 }
 return rows;
}
// Holdings share one cash budget; each runs its own path, then sale taxes are combined.
// US-listed gains and losses offset each other and share one annual allowance; domestic "other" ETFs are taxed per fund.
function simulatePortfolio(p,holdings){
 const active=holdings.filter(h=>h.weight>0||h.initial>0);
 const runs=active.map(h=>({h,rows:simulate({...p,...h,monthly:p.monthly*h.weight/100,divTax:h.route==='us'?p.divTaxUs:p.divTaxKr,allowance:0})}));
 const sum=['principal','value','monthlyProfit','dividend','dt','sellFee','exitFx','buyFees','exchangeFees','divTaxes','dividends'];
 return runs[0].rows.map((_,i)=>{
  const row={m:i+1,parts:runs.map(r=>({...r.rows[i],id:r.h.id,route:r.h.route}))};
  sum.forEach(k=>row[k]=row.parts.reduce((a,x)=>a+x[k],0));
  const usGain=row.parts.filter(x=>x.route==='us').reduce((a,x)=>a+x.gain,0);
  row.usTax=row.parts.some(x=>x.route==='us')?Math.max(0,usGain-p.allowance)*.22:0;
  row.krTax=row.parts.filter(x=>x.route==='krOther').reduce((a,x)=>a+x.tax,0);
  row.tax=row.usTax+row.krTax;row.profit=row.value-row.principal;
  row.net=row.value-row.sellFee-row.exitFx-row.tax;row.netProfit=row.net-row.principal;
  return row;
 });
}
if(typeof module!=='undefined')module.exports={simulate,simulatePortfolio};else{root.simulate=simulate;root.simulatePortfolio=simulatePortfolio;}
})(typeof window!=='undefined'?window:globalThis);
