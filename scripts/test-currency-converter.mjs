import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch();
try {
 for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1100}});const page=await context.newPage();
 await page.route('**/api/exchange-rates',route=>route.abort());
 await page.goto('http://localhost:3000/account/wallet');
 const converter=page.getByRole('region',{name:'Currency converter'});
 await converter.getByLabel('Amount',{exact:true}).fill('10.93');
 await expect(converter.locator('.conversion-results')).toContainText('XLM1');
 await converter.getByLabel('Currency',{exact:true}).selectOption('USD');
 await converter.getByLabel('Amount',{exact:true}).fill('0.17');
 await expect(converter.locator('.conversion-results')).toContainText('XLM1');
 await expect(converter.locator('.conversion-results')).toContainText('USDC0.17');
 await converter.getByLabel('Currency',{exact:true}).selectOption('JPY');
 await converter.getByLabel('Amount',{exact:true}).fill('27');
 await expect(converter.locator('.conversion-results')).toContainText('XLM1');
 await converter.getByLabel('Currency',{exact:true}).selectOption('EUR');
 await converter.getByLabel('Amount',{exact:true}).fill('0.15');
 await expect(converter.locator('.conversion-results')).toContainText('XLM1');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await context.close();console.log(`PASS ${width}px: fixed owner-supplied rates, JPY, USDC conversion and offline operation`);
 }
}finally{await browser.close();}
