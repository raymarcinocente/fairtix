import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch();const base='http://localhost:3000';let seller,buyer;
async function api(ctx,action,data){const r=data===undefined?await ctx.request.get(`${base}/api/demo/${action}`):await ctx.request.post(`${base}/api/demo/${action}`,{data,headers:{Origin:base}});return {status:r.status(),data:await r.json()};}
try {
 seller=await browser.newContext();buyer=await browser.newContext();
 await api(seller,'auth/wallet',{wallet:'ana'});await api(buyer,'auth/wallet',{wallet:'ben'});
 const inv=(await api(seller,'inventory')).data;
 const seed=inv.resale.find(l=>l.eventId==='golden-hour');
 await api(seller,'resale/hold',{id:seed.id});
 const fee=Math.round(seed.price*5)/100;const total=Math.round((seed.price+fee)*100)/100;
 const bought=await api(seller,'resale/buy',{id:seed.id,total,paymentMode:'demo'});expect(bought.status).toBe(200);
 const booking=bought.data.booking;const ticket=booking.lineItems[0];
 expect((await api(buyer,'resale/list',{bookingId:booking.id,seatId:ticket.id,price:50})).status).toBe(404);
 expect((await api(seller,'resale/list',{bookingId:booking.id,seatId:ticket.id,price:10000})).status).toBe(400);
 const page=await seller.newPage();await page.goto(`${base}/tickets`);
 await page.getByRole('button',{name:'Sell Ticket',exact:true}).click();
 await page.getByLabel('Resale price (USDC)',{exact:true}).fill('80');
 await page.getByRole('button',{name:'List Ticket',exact:true}).click();
 await expect(page.getByText('Listed for 80.00 USDC',{exact:true})).toBeVisible();
 const own=(await api(seller,'records')).data.ownResale[0];expect(own).toBeTruthy();
 expect((await api(seller,'resale/hold',{id:own.id})).status).toBe(400);
 expect((await api(seller,'scan',{id:booking.id})).data.ok).toBe(false);
 expect((await api(seller,'resale/list',{bookingId:booking.id,seatId:ticket.id,price:80})).status).toBe(409);
 const publicInv=(await api(buyer,'inventory')).data;expect(publicInv.resale.some(l=>l.id===own.id&&l.ticket.id===ticket.id)).toBe(true);
 await page.getByRole('button',{name:'Cancel Listing',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sell Ticket',exact:true})).toBeVisible();
 const relist=await api(seller,'resale/list',{bookingId:booking.id,seatId:ticket.id,price:80});expect(relist.status).toBe(200);
 await api(buyer,'resale/hold',{id:relist.data.id});
 expect((await api(seller,'resale/cancel',{id:relist.data.id})).status).toBe(409);
 expect((await api(buyer,'resale/buy',{id:relist.data.id,total:84,paymentMode:'demo'})).status).toBe(200);
 expect((await api(seller,'records')).data.bookings).toHaveLength(0);
 expect((await api(buyer,'records')).data.bookings[0].lineItems[0].id).toBe(ticket.id);
 await page.goto(`${base}/concerts/wild-hearts`);
 await page.getByRole('button',{name:'Select Seats',exact:true}).click();
 await page.getByRole('button',{name:/^VVIP[^,]*, VVIP,/}).click();
 for(let i=0;i<2;i++) await page.getByRole('button',{name:/^VVIP[^,]*, Row B, Seat [0-9]+, available/}).first().click();
 await page.getByRole('button',{name:'Continue to Checkout'}).click();
 await page.getByRole('button',{name:/Complete Booking/}).click();
 await expect(page.getByText('Your booking is confirmed.')).toBeVisible();
 const multi=(await api(seller,'records')).data.bookings.find(b=>b.eventId==='wild-hearts');
 expect(multi.seats).toHaveLength(2);
 const split=await api(seller,'resale/list',{bookingId:multi.id,seatId:multi.lineItems[0].id,price:multi.lineItems[0].price});
 expect(split.status).toBe(200);
 const after=(await api(seller,'records')).data;
 expect(after.bookings.filter(b=>b.eventId==='wild-hearts')).toHaveLength(2);
 expect(after.bookings.find(b=>b.id===multi.id).seats).toHaveLength(1);
 expect((await api(buyer,'inventory')).data.resale.find(l=>l.id===split.data.id).ticket.id).toBe(multi.lineItems[0].id);
 console.log('PASS sell dialog, listing, price cap, ownership, duplicate protection, cancellation, scan blocking, fixed-seat resale transfer and selling one seat from a two-seat booking');
} finally {
 if(buyer)await api(buyer,'reset',{});if(seller)await api(seller,'reset',{});
 await browser.close();
}

