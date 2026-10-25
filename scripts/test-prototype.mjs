import { chromium, expect } from "@playwright/test";
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
let context;
async function api(ctx, action, body) {
  const response =
    body === undefined
      ? await ctx.request.get(`${base}/api/demo/${action}`)
      : await ctx.request.post(`${base}/api/demo/${action}`, {
          data: body,
          headers: { Origin: base },
        });
  return { status: response.status(), data: await response.json() };
}
try {
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/tickets`);
  await expect(page.getByRole("heading", { name: /My tickets/ })).toBeVisible();
  await expect(page.getByText("No tickets yet", { exact: true })).toBeVisible();
  expect((await api(context, "session")).data.user.id).toMatch(/^prototype-/);
  for (const path of [
    "login",
    "register",
    "forgot-password",
    "reset-password",
    "verify-email",
  ]) {
    await page.goto(`${base}/${path}`);
    await expect(page).toHaveURL(`${base}/`);
  }
  await expect(
    page.getByRole("link", { name: /^(Sign In|Register|Sign Up)$/ }),
  ).toHaveCount(0);
  await page.goto(`${base}/concerts/neon-nights`);
  await page.getByRole("button", { name: "Select Seats", exact: true }).click();
  await page.getByRole("button", { name: /^VVIP Front, VVIP,/ }).click();
  await page
    .getByRole("button", { name: /^VVIP Front, Row B, Seat 3, available/ })
    .click();
  await page.getByRole("button", { name: "Continue to Checkout" }).click();
  await expect(
    page.getByRole("heading", { name: "Checkout", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/concerts\/neon-nights$/);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: /Ana.s sample wallet/ }).click();
  await page.getByRole("button", { name: /Complete Booking/ }).click();
  await expect(page.getByText("Your booking is confirmed.")).toBeVisible();
  const record = (await api(context, "records")).data.bookings[0];
  expect(record).toBeTruthy();
  await page.goto(`${base}/tickets`);
  await expect(page.locator(".showcase-ticket")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".showcase-ticket")).toHaveCount(1);
  await page.goto(`${base}/account/wallet`);
  await page
    .getByRole("button", { name: "Disconnect Wallet", exact: true })
    .click();
  await expect(
    page.getByText("No wallet connected.", { exact: true }),
  ).toBeVisible();
  await page.goto(`${base}/tickets`);
  await expect(page.locator(".showcase-ticket")).toHaveCount(1);
  const other = await browser.newContext();
  await api(other, "prototype", {});
  expect((await api(other, "records")).data.bookings).toHaveLength(0);
  expect((await api(other, "organizer/bookings")).data.bookings).toHaveLength(
    0,
  );
  expect((await api(other, "scan", { id: record.id })).data.ok).toBe(false);
  expect((await api(other, "admin/accounts")).status).toBe(404);
  await api(context, "auth/wallet", { wallet: "ana" });
  const ticket = (await api(context, "tickets/buy", {})).data.ticket;
  expect(ticket).toBeTruthy();
  expect(
    (await api(context, "tickets/list", { id: ticket.id, price: 1.1 })).status,
  ).toBe(200);
  await api(other, "auth/wallet", { wallet: "ben" });
  expect((await api(other, "tickets/transfer", { id: ticket.id })).status).toBe(
    200,
  );
  expect((await api(context, "records")).data.tickets).toHaveLength(0);
  expect((await api(other, "records")).data.tickets).toHaveLength(1);
  expect((await api(other, "scan", { id: ticket.id })).data.ok).toBe(true);
  await api(other, "reset", {});
  await other.close();
  expect(
    (
      await api(context, "auth/login", {
        email: "unused@example.test",
        password: "unused",
      })
    ).status,
  ).toBe(410);
  expect((await api(context, "auth/register", {})).status).toBe(410);
  await page.goto(`${base}/organizer`);
  await expect(
    page.getByRole("heading", { name: "Organizer Dashboard" }),
  ).toBeVisible();
  expect((await api(context, "scan", { id: record.id })).data.ok).toBe(true);
  expect(errors).toEqual([]);
  console.log(
    "PASS: no login/sign-up routes or controls, direct checkout, wallet connection, purchase persistence, anonymous browser isolation, organizer tools and scoped scanning.",
  );
} finally {
  if (context) {
    for (const page of context.pages()) {
      const session = await page
        .evaluate(() => sessionStorage.getItem("fairtix-seating-v1"))
        .catch(() => null);
      if (session) await api(context, "holds/release", { session });
    }
    await api(context, "reset", {});
  }
  await browser.close();
}
