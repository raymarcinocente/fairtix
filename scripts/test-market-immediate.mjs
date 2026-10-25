import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch();
try {
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 const page=await context.newPage();
 let release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/demo/**',async route=>{await gate;await route.continue();});
 await page.goto('http://localhost:3000/market');
 await expect(page.locator('.sample-resale-card')).toHaveCount(5);
 await expect(page.getByRole('button',{name:'Buy Ticket',exact:true})).toHaveCount(5);
 await expect(page.getByText('Loading resale tickets…',{exact:true})).toHaveCount(0);
 console.log('PASS: all five listings visible with every API request still pending');
 await page.screenshot({path:'.next/resale-five-listings.png',fullPage:true});
 release(); await context.close();
} finally {await browser.close();}
