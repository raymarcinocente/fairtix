import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch();
try {
  for(const mode of ['normal','account-error','account-pending']) {
    const context=await browser.newContext();
    const page=await context.newPage();
    let release;
    const gate=new Promise(resolve=>release=resolve);
    if(mode==='account-error') await page.route('**/api/demo/records',route=>route.fulfill({status:500,json:{error:'Account unavailable'}}));
    if(mode==='account-pending') await page.route('**/api/demo/prototype',async route=>{await gate;await route.continue();});
    await page.goto('http://localhost:3000/market');
    await expect(page.locator('.sample-resale-card')).toHaveCount(5);
    await expect(page.getByRole('button',{name:'Buy Ticket',exact:true})).toHaveCount(5);
    console.log(`PASS: five purchasable listings with ${mode}`);
    release();
    await context.close();
  }
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.route('**/api/demo/inventory',route=>route.fulfill({status:503,json:{error:'Unavailable'}}));
  await page.goto('http://localhost:3000/market');
  await expect(page.getByRole('button',{name:'Retry',exact:true})).toBeVisible();
  await page.unroute('**/api/demo/inventory');
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.locator('.sample-resale-card')).toHaveCount(5);
  console.log('PASS: inventory failure displays Retry and recovers all five listings');
  await context.close();
} finally { await browser.close(); }
