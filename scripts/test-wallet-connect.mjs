import {chromium,expect} from '@playwright/test';
const base='http://localhost:3000';
const browser=await chromium.launch();
try {
 const context=await browser.newContext();
 const response=await context.request.post(`${base}/api/demo/auth/wallet`,{data:{wallet:'ana'},headers:{Origin:base}});
 expect(response.status()).toBe(200);
 expect((await response.json()).user.wallet).toBe('ana');
 console.log('PASS wallet connects directly without prior prototype initialization');
 await context.close();
 const ctx=await browser.newContext(); const page=await ctx.newPage();
 let release; const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/demo/prototype',async route=>{await gate;await route.continue();});
 await page.goto(`${base}/concerts/neon-nights`);
 await page.getByRole('button',{name:'Select Seats',exact:true}).click();
 await page.getByRole('button',{name:/^VVIP Front, VVIP,/}).click();
 await page.getByRole('button',{name:/^VVIP Front, Row B, Seat [0-9]+, available/}).first().click();
 await page.getByRole('button',{name:'Continue to Checkout'}).click();
 await page.getByRole('button',{name:'Connect',exact:true}).click();
 await page.getByRole('button',{name:/Ana.s sample wallet/}).click();
 await expect(page.getByRole('heading',{name:'Connect Wallet',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Checkout',exact:true})).toBeVisible();
 await expect(page.getByText(/GABC.*7XQ2/)).toBeVisible();
 console.log('PASS sample wallet connects during pending initialization and preserves checkout');
 release();
 const session=await page.evaluate(()=>sessionStorage.getItem('fairtix-seating-v1'));
 await ctx.request.post(`${base}/api/demo/holds/release`,{data:{session,eventId:'neon-nights'},headers:{Origin:base}});
 await page.getByRole('button',{name:'Close seat selection'}).click();
 await ctx.close();
} finally {await browser.close();}

