(function(root){
function simulate(p){
 const months=Math.round(p.years*12),b=p.broker/100,f=p.route==='us'?p.fxFee/100:0,t=p.divTax/100;
 const effectiveRate=(1+p.rate/100)*(1-(p.expense??0)/100)/(1-(p.refExpense??0)/100)-1;
 const q=Math.pow(1+effectiveRate,1/12)-1,pGrowth=q-p.yield/1200,fxGrowth=p.route==='us'?Math.pow(1+p.fxChange/100,1/12):1;
 let units=0,price=p.price,fx=p.route==='us'?p.fx:1,basis=0,principal=0,buyFees=0,exchangeFees=0,divTaxes=0,dividends=0,rows=[];
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
  rows.push({m,principal,value,profit:value-principal,monthlyProfit:value-prev-p.monthly,dividend,dt,net,netProfit:net-principal,tax,sellFee,exitFx,buyFees,exchangeFees,divTaxes,dividends,price,fx,units,basis});
 }
 return rows;
}
if(typeof module!=='undefined')module.exports={simulate};else root.simulate=simulate;
})(typeof window!=='undefined'?window:globalThis);
