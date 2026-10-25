import { chromium, expect } from '@playwright/test';
import {randomUUID} from 'node:crypto';
const browser=await chromium.launch(); const base='http://localhost:3000';
async function api(ctx,action,data){const r=data===undefined?await ctx.request.get(`${base}/api/demo/${action}`):await ctx.request.post(`${base}/api/demo/${action}`,{data,headers:{Origin:base}});return {status:r.status(),data:await r.json()};}
try{
 for(const width of [1440,390]){
 const ctx=await browser.newContext({viewport:{width,height:1100}});
 try{
 await api(ctx,'auth/wallet',{wallet:'ana'});
 const page=await ctx.newPage();await page.goto(`${base}/account/wallet`);
 const converter=page.getByRole('region',{name:'Currency converter'});
 await converter.getByLabel('Amount',{exact:true}).fill('10.93');
 await converter.getByLabel('Add to wallet as',{exact:true}).selectOption('USDC');
 await converter.getByRole('button',{name:'Convert and Add to Wallet',exact:true}).click();
 await expect(converter.getByRole('status')).toContainText('0.1700000 USDC added');
 let records=(await api(ctx,'records')).data;expect(records.usdcBalance).toBe(0.17);expect(records.balance).toBe(10);
 const body={amount:0.17,currency:'USD',asset:'XLM',fundingMethod:'mastercard',paymentMode:'demo',requestId:randomUUID(),credited:999999};
 expect((await api(ctx,'wallet/convert',body)).status).toBe(200);
 expect((await api(ctx,'wallet/convert',body)).status).toBe(200);
 records=(await api(ctx,'records')).data;expect(records.balance).toBe(11);expect(records.transactions.filter(t=>t.kind==='wallet conversion')).toHaveLength(2);
 expect(records.transactions.map(t=>t.fundingMethod)).toEqual(['gcash','mastercard']);
 expect((await api(ctx,'wallet/convert',{...body,requestId:randomUUID(),fundingMethod:'gcash'})).status).toBe(400);
 expect((await api(ctx,'wallet/convert',{...body,requestId:randomUUID(),fundingMethod:'bank'})).status).toBe(400);
 expect((await api(ctx,'wallet/convert',{...body,amount:100})).status).toBe(409);
 expect((await api(ctx,'wallet/convert',{...body,requestId:randomUUID(),amount:-1})).status).toBe(400);
 expect((await api(ctx,'wallet/convert',{...body,requestId:randomUUID(),paymentMode:'live'})).status).toBe(400);
 await page.reload();
 const balances=page.getByRole('region',{name:'Wallet balances'});
 await expect(balances.locator('dl > div').filter({has:page.getByText('USDC',{exact:true})}).locator('dd')).toHaveText('0.17');
 await expect(balances.locator('dl > div').filter({has:page.getByText('XLM',{exact:true})}).locator('dd')).toHaveText('11.00');
 await page.getByRole('button',{name:'Change Wallet',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('region',{name:'Wallet balances'})).toContainText('0.17');
 await page.getByRole('dialog').getByRole('button',{name:/Close/}).click();
 await page.goto(`${base}/account/transactions`);await expect(page.getByRole('heading',{name:'Wallet Conversion',exact:true})).toHaveCount(2);
 const other=await browser.newContext();await api(other,'auth/wallet',{wallet:'ben'});expect((await api(other,'records')).data.transactions).toHaveLength(0);await other.close();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 console.log(`PASS ${width}px: USDC/XLM sample credits, persistent balances, transaction logs, retry idempotency, rejected invalid requests and browser isolation`);
 }finally{await api(ctx,'reset',{});await ctx.close();}
 }
}finally{await browser.close();}
