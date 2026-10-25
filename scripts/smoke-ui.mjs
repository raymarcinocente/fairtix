import { chromium, expect } from "@playwright/test";
const base = process.env.BASE_URL || "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const context = page.context();
    const call = (action, data) =>
      context.request.post(`${base}/api/demo/${action}`, {
        data,
        headers: { Origin: base },
      });
    await call("auth/login", {
      email: "organizer@fairtix.demo",
      password: "DemoPass123!",
    });
    await call("reset", {});
    await call("auth/wallet", { wallet: null });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(base);
    await expect(page.locator(".cinematic-hero:visible h1")).toContainText(
      "AFTER HOURS",
    );
    await page.getByRole("button", { name: "Next featured concert" }).click();
    await expect(page.locator(".cinematic-hero:visible h1")).toContainText(
      "NIGHTS",
    );
    await page
      .getByRole("button", { name: "Previous featured concert" })
      .click();
    await page
      .getByRole("button", { name: "Save ILOILO AFTER HOURS", exact: true })
      .first()
      .click();
    await page.goto(`${base}/saved`);
    await expect(
      page.locator(".catalog-grid:visible .concert-card"),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "Search concerts", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Search by concert, genre or city" })
      .fill("neon");
    await expect(page.locator(".search-results a")).toHaveCount(1);
    await page.locator(".search-results a").click();
    await expect(page).toHaveURL(`${base}/concerts/neon-nights`);
    await page.getByRole("button", { name: "Select Seats" }).click();
    await page.getByRole("button", { name: /^VVIP Front, VVIP,/ }).click();
    await expect(
      page.getByRole("button", { name: /VVIP Front, Row A, Seat 4, held/ }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /VVIP Front, Row A, Seat 3, sold/ }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: /VVIP Front, Row A, Seat 1, available/ })
      .click();
    await page
      .getByRole("button", { name: /VVIP Front, Row A, Seat 2, available/ })
      .click();
    await expect(page.locator(".hold-countdown")).toBeVisible();
    await expect(page.locator(".venue-total")).toContainText("525.00 USDC");
    await page.getByRole("button", { name: "Continue to Checkout" }).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await page.getByRole("button", { name: /Ana’s demo wallet/ }).click();
    await expect(page.locator(".venue-total")).toContainText("525.00 USDC");
    await page
      .getByRole("button", { name: "Complete demo · 525.00 USDC" })
      .click();
    await expect(
      page.getByText("Your demo booking is confirmed."),
    ).toBeVisible();
    await page
      .locator("dialog[open]")
      .getByRole("link", { name: "My Tickets", exact: true })
      .click();
    await expect(page.locator(".showcase-ticket:visible")).toHaveCount(1);
    await page.getByRole("button", { name: "View Ticket" }).click();
    await expect(page.locator("dialog[open] .qr-code svg")).toBeVisible();
    await page
      .getByRole("link", { name: "Open gate check", exact: true })
      .click();
    const demoBooking = await page.evaluate(
      async () => (await (await fetch("/api/demo/records")).json()).bookings[0],
    );
    await page.getByLabel("Ticket ID", { exact: true }).fill(demoBooking.id);
    await page.getByRole("button", { name: "Check ticket" }).click();
    await expect(page.locator(".scan-result:visible")).toContainText(
      "Entry granted",
    );
    await page.getByRole("button", { name: "Check ticket" }).click();
    await expect(page.locator(".scan-result:visible")).toContainText(
      "already redeemed",
    );
    await page.goto(`${base}/account/transactions`);
    await expect(page.locator(".account-bookings")).toContainText(
      "525.00 USDC",
    );
    await page.goto(`${base}/concerts/neon-nights`);
    await page.getByRole("button", { name: "Select Seats" }).click();
    await page.getByRole("button", { name: /^VVIP Front, VVIP,/ }).click();
    await expect(
      page.getByRole("button", { name: /VVIP Front, Row A, Seat 1, sold/ }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Close seat selection" }).click();

    // The original XLM event, resale and entry rules remain intact.
    await page.goto(`${base}/event`);
    await page.getByRole("button", { name: "Buy ticket · 1 XLM" }).click();
    await page.getByRole("button", { name: "Complete demo purchase" }).click();
    await expect(page.getByText("Your demo ticket is ready.")).toBeVisible();
    await page
      .locator("dialog[open]")
      .getByRole("link", { name: "My Tickets", exact: true })
      .click();
    await page
      .getByRole("button", { name: "List for resale", exact: true })
      .click();
    await page.getByLabel("Your resale price (XLM)").fill("1.5");
    await page.getByRole("button", { name: "Submit listing" }).click();
    await expect(page.locator(".form-error")).toContainText("up to 1.1 XLM");
    await page.getByLabel("Your resale price (XLM)").fill("1.1");
    await page.getByRole("button", { name: "Submit listing" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "is listed" }),
    ).toBeVisible();
    const originalTicket = await page.evaluate(
      async () => (await (await fetch("/api/demo/records")).json()).tickets[0],
    );
    await call("auth/login", {
      email: "ben@fairtix.demo",
      password: "DemoPass123!",
    });
    await call("reset", {});
    await page.goto(`${base}/account/wallet`);
    await page
      .getByRole("button", {
        name: /^(Change Demo Wallet|Connect Demo Wallet)$/,
      })
      .click();
    await page.getByRole("button", { name: /Ben’s demo wallet/ }).click();
    await page.goto(`${base}/market`);
    await page.getByRole("button", { name: "Buy for 1.1 XLM" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "transferred" }),
    ).toBeVisible();
    await page.goto(`${base}/tickets`);
    await expect(page.locator(".owned-ticket:visible")).toHaveCount(1);
    await page.getByRole("button", { name: "Show QR", exact: true }).click();
    await expect(page.locator("dialog[open] .qr-code svg")).toBeVisible();
    await call("auth/login", {
      email: "organizer@fairtix.demo",
      password: "DemoPass123!",
    });
    await page.goto(`${base}/scan`);
    await page.getByLabel("Ticket ID", { exact: true }).fill(originalTicket.id);
    await page.getByRole("button", { name: "Check ticket" }).click();
    await expect(page.locator(".scan-result:visible")).toContainText(
      "Entry granted",
    );
    await page.getByRole("button", { name: "Check ticket" }).click();
    await expect(page.locator(".scan-result:visible")).toContainText(
      "already redeemed",
    );
    await page.reload();
    await expect(page.locator(".history-item:visible")).toHaveCount(4);
    await page.getByLabel("Ticket ID", { exact: true }).fill("NOT-A-TICKET");
    await page.getByRole("button", { name: "Check ticket" }).click();
    await expect(page.locator(".scan-result:visible")).toContainText(
      "Ticket not found",
    );

    const routes = [
      "/",
      "/event",
      "/concerts",
      "/concerts/neon-nights",
      "/tickets",
      "/market",
      "/scan",
      "/guide",
      "/saved",
      "/profile",
      "/organizer",
      "/presale",
      "/upcoming",
      "/venues",
      "/login",
      "/register",
      "/forgot-password",
      "/account",
      "/account/profile",
      "/account/security",
      "/account/wallet",
      "/account/transactions",
    ];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(base + route);
        await expect(page.locator("h1:visible")).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        if (overflow)
          throw new Error(`Horizontal overflow at ${width}px: ${route}`);
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(base);
    await page.getByRole("button", { name: "Next featured concert" }).click();
    await expect(page.locator(".cinematic-hero:visible h1")).toContainText(
      "NIGHTS",
    );
    await call("reset", {});
    await call("auth/login", {
      email: "ben@fairtix.demo",
      password: "DemoPass123!",
    });
    await call("reset", {});
    if (errors.length) throw new Error([...new Set(errors)].join("\n"));
    console.log(
      "PASS: discovery, saved shows, search, demo seats/holds/fees/checkout, booked seat protection, both QR/entry flows, original XLM purchase/resale, history, responsive route checks including authentication and account pages, reduced motion, and no browser errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
