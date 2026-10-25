import { chromium, expect } from "@playwright/test";
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
let buyer, other;
async function api(context, action, body) {
  const response =
    body === undefined
      ? await context.request.get(`${base}/api/demo/${action}`)
      : await context.request.post(`${base}/api/demo/${action}`, {
          data: body,
          headers: { Origin: base },
        });
  return { status: response.status(), data: await response.json() };
}
try {
  buyer = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  other = await browser.newContext();
  await api(other, "prototype", {});
  const page = await buyer.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/market`);
  await expect(page.locator(".resale-catalog-grid article")).toHaveCount(5);
  const inventory = (await api(buyer, "inventory")).data;
  const listing = inventory.resale.find((l) => l.eventId === "neon-nights");
  expect(listing.ticket.row).not.toBeNull();
  const card = page
    .locator(".sample-resale-card")
    .filter({
      has: page.getByRole("heading", { name: "NEON NIGHTS", exact: true }),
    });
  await card.getByRole("button", { name: "Buy Ticket", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Buy resale ticket",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".venue-zone.active")).toHaveCount(1);
  await expect(dialog.locator(".ticket-seat")).toHaveCount(1);
  await expect(dialog.locator(".resale-seat-location")).toContainText(
    `Row ${listing.ticket.row}`,
  );
  await expect(dialog.locator(".resale-seat-location")).toContainText(
    `Seat ${listing.ticket.number}`,
  );
  await expect(
    dialog.getByRole("button", { name: "Select Seats", exact: true }),
  ).toHaveCount(0);
  for (const zone of await dialog.locator(".venue-zone").all())
    await expect(zone).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Continue to Checkout" }),
  ).toBeEnabled();
  expect((await api(other, "resale/hold", { id: listing.id })).status).toBe(
    409,
  );
  expect(
    (
      await api(other, "resale/buy", {
        id: listing.id,
        total: 1,
        paymentMode: "demo",
      })
    ).status,
  ).not.toBe(200);
  await dialog.getByRole("button", { name: "Continue to Checkout" }).click();
  await expect(
    dialog.locator(".booking-stepper [aria-current=step]"),
  ).toContainText("Payment");
  await dialog.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: /Ana.s sample wallet/ }).click();
  expect(
    (
      await api(buyer, "resale/buy", {
        id: listing.id,
        total: 0,
        paymentMode: "demo",
      })
    ).status,
  ).toBe(400);
  await dialog.getByRole("button", { name: "Buy Ticket", exact: true }).click();
  await expect(dialog.getByText("Your resale ticket is ready.")).toBeVisible();
  const purchase = (await api(buyer, "records")).data;
  expect(purchase.bookings).toHaveLength(1);
  expect(purchase.bookings[0].seats).toEqual([listing.ticket.id]);
  expect(purchase.bookings[0].lineItems[0].sectionId).toBe(
    listing.ticket.sectionId,
  );
  expect(purchase.transactions[0].kind).toBe("resale purchase");
  expect((await api(other, "resale/hold", { id: listing.id })).status).toBe(
    409,
  );
  expect((await api(other, "records")).data.bookings).toHaveLength(0);
  await dialog.getByRole("link", { name: "View Ticket", exact: true }).click();
  await expect(page.locator(".showcase-ticket")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".showcase-ticket")).toHaveCount(1);
  await api(buyer, "reset", {});
  expect((await api(buyer, "inventory")).data.resale).toHaveLength(5);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/market`);
    const gaCard = page
      .locator(".sample-resale-card")
      .filter({
        has: page.getByRole("heading", { name: "PULSE FESTIVAL", exact: true }),
      });
    await gaCard
      .getByRole("button", { name: "Buy Ticket", exact: true })
      .click();
    await expect(dialog.locator(".venue-zone.active")).toHaveCount(1);
    await expect(
      dialog.getByText(
        "General admission · 1 ticket. This area has no assigned rows or seats.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /Add a ticket/ }),
    ).toHaveCount(0);
    expect(
      await dialog.evaluate((el) => el.scrollWidth > el.clientWidth + 1),
    ).toBe(false);
    const action = await dialog
      .getByRole("button", { name: "Continue to Checkout" })
      .boundingBox();
    expect(action.y + action.height).toBeLessThanOrEqual(900);
    await dialog.getByRole("button", { name: "Close resale ticket" }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${base}/market`);
  await page
    .locator(".sample-resale-card")
    .filter({
      has: page.getByRole("heading", { name: "PULSE FESTIVAL", exact: true }),
    })
    .getByRole("button", { name: "Buy Ticket", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Continue to Checkout" }).click();
  await dialog.getByRole("button", { name: "Buy Ticket", exact: true }).click();
  await expect(dialog.getByText("Your resale ticket is ready.")).toBeVisible();
  expect(
    (await api(buyer, "records")).data.bookings[0].lineItems[0].row,
  ).toBeNull();
  expect(errors).toEqual([]);
  console.log(
    "PASS: dedicated resale checkout, fixed seat visual, read-only venue map, holds, price validation, single transfer, persistent tickets, GA purchase and mobile layout.",
  );
} finally {
  if (buyer) await api(buyer, "reset", {});
  if (other) await api(other, "reset", {});
  await browser.close();
}
