import { chromium, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
const errors = [];
const suffix = Date.now();
async function api(context, action, body) {
  const response =
    body === undefined
      ? await context.request.get(`${base}/api/demo/${action}`)
      : await context.request.post(`${base}/api/demo/${action}`, {
          data: body,
          headers: { Origin: base },
        });
  return { status: response.status(), data: await response.json(), response };
}
async function login(page, email, password = "DemoPass123!", remember = false) {
  await page
    .locator(".account-form:visible")
    .getByLabel("Email address", { exact: true })
    .fill(email);
  await page
    .locator(".account-form:visible")
    .getByLabel("Password", { exact: true })
    .fill(password);
  if (remember)
    await page
      .locator(".account-form:visible")
      .getByLabel("Remember me")
      .check();
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}
async function signout(page) {
  await page.getByLabel("Account menu").click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}
function freeSeat(eventId) {
  const db = JSON.parse(readFileSync(".data/mock-accounts.json", "utf8"));
  for (const row of ["A", "B"])
    for (let n = 1; n <= 8; n++) {
      const id = "vvip-front/" + row + "/" + n;
      if ((row === "A" && (n === 3 || n === 4)) || (row === "B" && n === 2))
        continue;
      if (
        !db.bookings.some(
          (b) => b.eventId === eventId && b.seats.includes(id),
        ) &&
        !db.holds.some(
          (h) =>
            h.eventId === eventId &&
            h.expires > Date.now() &&
            h.seats.includes(id),
        )
      )
        return { id, row, n };
    }
  throw new Error("No free fixture seat");
}
let fixtureContext;
try {
  const chosen = freeSeat("neon-nights"),
    expiring = freeSeat("golden-hour");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  fixtureContext = context;
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await expect(
    page.getByRole("link", { name: "Sign In", exact: true }),
  ).toBeVisible();
  console.log("Guest browsing passed");
  await page.goto(`${base}/tickets`);
  await expect(page).toHaveURL(/\/login\?returnTo=%2Ftickets/);
  expect((await api(context, "records")).status).toBe(401);
  await login(page, "ana@fairtix.demo", "wrong-password");
  await expect(page.locator(".seat-error")).toContainText("incorrect");
  await page.goto(`${base}/concerts/neon-nights`);
  await page.getByRole("button", { name: "Select Seats", exact: true }).click();
  await page.getByRole("button", { name: /^VVIP Front, VVIP,/ }).click();
  await page
    .getByRole("button", {
      name: new RegExp(
        `VVIP Front, Row ${chosen.row}, Seat ${chosen.n}, available`,
      ),
    })
    .click();
  await page.getByRole("button", { name: "Continue to Checkout" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByRole("link", { name: "Create Account", exact: true }).click();
  await page
    .locator(".account-form:visible")
    .getByLabel("First name", { exact: true })
    .fill("Customer");
  await page
    .locator(".account-form:visible")
    .getByLabel("Last name", { exact: true })
    .fill("One");
  await page
    .locator(".account-form:visible")
    .getByLabel("Email address", { exact: true })
    .fill(`auth-${suffix}@example.test`);
  await page
    .locator(".account-form:visible")
    .getByLabel("Password", { exact: true })
    .fill("TestPassword123!");
  await page
    .locator(".account-form:visible")
    .getByLabel("Confirm password", { exact: true })
    .fill("TestPassword123!");
  await page
    .locator(".account-form:visible")
    .getByLabel(/I agree/)
    .check();
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/concerts\/neon-nights\?checkout=1/);
  await expect(
    page.getByRole("heading", { name: "Checkout", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".venue-total")).toContainText("262.50");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: /Ana.s demo wallet/ }).click();
  await page.getByRole("button", { name: /Complete demo/ }).click();
  await expect(page.getByText("Your demo booking is confirmed.")).toBeVisible();
  console.log("Registration and checkout passed");
  const own = await api(context, "records");
  expect(own.data.bookings).toHaveLength(1);
  const booking = own.data.bookings[0];
  expect(booking.lineItems[0].id).toBe(chosen.id);
  expect((await api(context, "organizer/bookings")).status).toBe(403);
  expect((await api(context, "organizer/authorize", {})).status).toBe(403);
  expect((await api(context, "scan", { id: booking.id })).status).toBe(403);
  expect((await api(context, "admin/accounts")).status).toBe(403);
  await page.goto(`${base}/organizer`);
  await expect(page).toHaveURL(/\/account\?access=denied/);
  await page.goto(`${base}/account/wallet`);
  await page
    .getByRole("button", { name: "Disconnect Wallet", exact: true })
    .click();
  await expect(page.getByText("No wallet connected.")).toBeVisible();
  await page.goto(`${base}/tickets`);
  await expect(page.locator(".showcase-ticket")).toHaveCount(1);
  await page.getByRole("button", { name: "View Ticket", exact: true }).click();
  await expect(page.locator("dialog[open] .qr-code svg")).toBeVisible();
  await page.getByLabel("Close pass").click();
  await page.reload();
  await expect(page.locator(".showcase-ticket")).toHaveCount(1);
  expect(
    await page.evaluate(() => document.cookie.includes("fairtix_session")),
  ).toBe(false);
  const cookie = (await context.cookies()).find(
    (c) => c.name === "fairtix_session",
  );
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  const storage = await page.evaluate(() => Object.keys(localStorage));
  expect(storage).not.toContain("fairtix-showcase-v1");
  expect(storage).not.toContain("fairtix-ui-demo-v1");
  await page.goto(`${base}/account/profile`);
  await page
    .locator(".account-form:visible")
    .getByLabel("First name", { exact: true })
    .fill("Updated");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("status")).toContainText("Profile updated");
  const oldCookie = cookie.value;
  await signout(page);
  expect((await api(context, "records")).status).toBe(401);
  const replay = await context.request.get(`${base}/api/demo/records`, {
    headers: { Cookie: `fairtix_session=${oldCookie}` },
  });
  expect(replay.status()).toBe(401);
  await login(page, "ben@fairtix.demo", undefined, true);
  await expect(page).toHaveURL(/\/account$/);
  expect((await api(context, "records")).data.bookings).toHaveLength(0);
  await page.goto(`${base}/account/wallet`);
  await page
    .getByRole("button", { name: /^(Connect Demo Wallet|Change Demo Wallet)$/ })
    .click();
  await page.getByRole("button", { name: /Ana.s demo wallet/ }).click();
  expect((await api(context, "records")).data.bookings).toHaveLength(0);
  const remembered = (await context.cookies()).find(
    (c) => c.name === "fairtix_session",
  );
  expect(remembered.expires).toBeGreaterThan(Date.now() / 1000 + 86400);
  const csrf = await context.request.post(`${base}/api/demo/auth/logout`, {
    data: {},
    headers: { Origin: "https://untrusted.example" },
  });
  expect(csrf.status()).toBe(403);
  const publicData = (await api(context, "inventory")).data;
  expect(JSON.stringify(publicData)).not.toContain(booking.id);
  expect(JSON.stringify(publicData)).not.toContain(`auth-${suffix}`);
  await signout(page);
  await page.goto(`${base}/concerts/golden-hour`);
  await page.getByRole("button", { name: "Select Seats", exact: true }).click();
  await page.getByRole("button", { name: /^VVIP Front,/ }).click();
  await page
    .getByRole("button", {
      name: new RegExp(
        `VVIP Front, Row ${expiring.row}, Seat ${expiring.n}, available`,
      ),
    })
    .click();
  await page.getByRole("button", { name: "Continue to Checkout" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.clock.install();
  await page.clock.fastForward(301000);
  await login(page, "ben@fairtix.demo");
  await expect(page).toHaveURL(/golden-hour\?checkout=1/);
  await expect(page.locator(".seat-error")).toContainText("expired");
  await expect(
    page.getByRole("button", { name: "Continue to Checkout" }),
  ).toBeDisabled();
  await page.goto(`${base}/login?returnTo=https://untrusted.example`);
  await login(page, "organizer@fairtix.demo");
  await expect(page).toHaveURL(/\/account$/);
  await page.goto(`${base}/organizer`);
  await expect(
    page.getByRole("heading", { name: "Organizer Dashboard" }),
  ).toBeVisible();
  expect(
    (await api(context, "organizer/bookings")).data.bookings.some(
      (b) => b.id === booking.id,
    ),
  ).toBe(true);
  expect((await api(context, "admin/accounts")).status).toBe(403);
  expect((await api(context, "scan", { id: booking.id })).data.ok).toBe(true);
  expect((await api(context, "scan", { id: booking.id })).data.ok).toBe(false);
  await signout(page);
  await page.goto(`${base}/forgot-password`);
  await page
    .locator(".account-form:visible")
    .getByLabel("Email address", { exact: true })
    .fill(`auth-${suffix}@example.test`);
  await page.getByRole("button", { name: "Request Reset" }).click();
  await expect(page.getByRole("status")).toContainText("No email was sent");
  const db = JSON.parse(readFileSync(".data/mock-accounts.json", "utf8"));
  const reset = db.outbox.findLast(
    (m) => m.email === `auth-${suffix}@example.test` && m.kind === "reset",
  );
  await page.goto(base + reset.link);
  await page
    .locator(".account-form:visible")
    .getByLabel("Password", { exact: true })
    .fill("ReplacementPass123!");
  await page
    .locator(".account-form:visible")
    .getByLabel("Confirm password", { exact: true })
    .fill("ReplacementPass123!");
  await page
    .getByRole("button", { name: "Set New Password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  expect(
    (
      await api(context, "auth/reset", {
        token: new URL(reset.link, base).searchParams.get("token"),
        password: "ReplacementPass123!",
        confirmPassword: "ReplacementPass123!",
      })
    ).status,
  ).toBe(400);
  const verify = db.outbox.findLast(
    (m) => m.email === `auth-${suffix}@example.test` && m.kind === "verify",
  );
  await page.goto(base + verify.link);
  await page.getByRole("button", { name: "Verify Email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("verified");
  await page.goto(`${base}/login`);
  await login(page, `auth-${suffix}@example.test`, "ReplacementPass123!");
  await expect(page).toHaveURL(/\/account$/);
  expect((await api(context, "session")).data.user.verified).toBe(true);
  const otherSession = await browser.newContext();
  expect(
    (
      await api(otherSession, "auth/login", {
        email: `auth-${suffix}@example.test`,
        password: "ReplacementPass123!",
      })
    ).status,
  ).toBe(200);
  await page.goto(`${base}/account/security`);
  await page
    .getByLabel("Current password", { exact: true })
    .fill("incorrect-password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("ChangedPassword123!");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("ChangedPassword123!");
  await page
    .getByRole("button", { name: "Update Password", exact: true })
    .click();
  await expect(page.locator(".seat-error")).toContainText("incorrect");
  await page
    .getByLabel("Current password", { exact: true })
    .fill("ReplacementPass123!");
  await page
    .getByRole("button", { name: "Update Password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Other sessions");
  expect((await api(otherSession, "records")).status).toBe(401);
  await otherSession.close();
  const privateTab = await context.newPage();
  await privateTab.goto(`${base}/tickets`);
  await expect(
    privateTab.getByRole("heading", { name: /My tickets/ }),
  ).toBeVisible();
  await api(context, "reset", {});
  await signout(page);
  await expect(privateTab).toHaveURL(/\/login\?returnTo=/);
  await privateTab.close();
  const admin = await browser.newContext();
  expect(
    (
      await api(admin, "auth/login", {
        email: "admin@fairtix.demo",
        password: "DemoPass123!",
      })
    ).status,
  ).toBe(200);
  expect((await api(admin, "admin/accounts")).status).toBe(200);
  await admin.close();
  expect(errors).toEqual([]);
  console.log(
    "Authentication checks passed: registration, checkout return, holds, wallet separation, ownership, sessions, roles, CSRF, profile, password reset, verification.",
  );
} finally {
  if (fixtureContext) {
    for (const p of fixtureContext.pages()) {
      const session = await p
        .evaluate(() => sessionStorage.getItem("fairtix-seating-v1"))
        .catch(() => null);
      if (session) await api(fixtureContext, "holds/release", { session });
    }
  }
  await browser.close();
}
