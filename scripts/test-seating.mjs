import { chromium, expect } from "@playwright/test";
const base = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
async function open(page, id = "neon-nights") {
  await page.goto(`${base}/concerts/${id}`);
  await page.getByRole("button", { name: "Select Seats", exact: true }).click();
}
const zone = (page, name) =>
  page.getByRole("button", { name: new RegExp(`^${name},`) });
const seat = (page, section, row, number, status) =>
  page.getByRole("button", {
    name: new RegExp(`^${section}, Row ${row}, Seat ${number}, ${status}`),
  });
const back = (page) =>
  page.getByRole("button", { name: "Back to Venue Map", exact: false }).click();
let fixtureContext, initialConfig;
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  fixtureContext = context;
  const call = (action, data) =>
    context.request.post(`${base}/api/demo/${action}`, {
      data,
      headers: { Origin: base },
    });
  await call("prototype", {});
  await call("reset", {});
  await call("auth/wallet", { wallet: null });
  initialConfig = await (
    await context.request.get(`${base}/api/demo/inventory`)
  ).json();
  const page = await context.newPage();
  watch(page);
  await open(page);
  await expect(page.locator(".venue-zone")).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "Continue to Checkout" }),
  ).toBeDisabled();
  for (const category of ["VVIP", "VIP", "Gold", "Silver", "General Admission"])
    await expect(page.locator(".venue-category-legend")).toContainText(
      category,
    );
  const mapFits = await page
    .locator(".venue-map-scroll")
    .evaluate((el) => el.scrollHeight <= el.clientHeight + 1);
  if (!mapFits)
    throw new Error(
      "The default desktop map must show all sections without vertical scrolling.",
    );
  await zone(page, "VVIP Front").click();
  await expect(seat(page, "VVIP Front", "A", 3, "sold")).toBeDisabled();
  await expect(seat(page, "VVIP Front", "A", 4, "held")).toBeDisabled();
  await expect(seat(page, "VVIP Front", "B", 2, "blocked")).toBeDisabled();
  await seat(page, "VVIP Front", "A", 1, "available").click();
  await expect(page.locator(".venue-total")).toContainText("262.50");
  await back(page);
  await zone(page, "VIP Left").click();
  await seat(page, "VIP Left", "A", 1, "available").click();
  await expect(page.locator(".venue-total")).toContainText("441.00");
  await expect(page.locator(".summary-category-group")).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Remove VVIP Front · Row A · Seat 1",
      exact: true,
    })
    .click();
  await expect(page.locator(".venue-total")).toContainText("178.50");
  await back(page);
  await zone(page, "General Admission Rear").click();
  await page
    .getByRole("button", { name: "Add a ticket from General Admission Rear" })
    .click();
  await expect(page.locator(".venue-total")).toContainText("225.75");
  await page.getByRole("button", { name: "Continue to Checkout" }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByRole("button", { name: /Ana’s sample wallet/ }).click();
  await page
    .getByRole("button", { name: "Complete Booking · 225.75 USDC" })
    .click();
  await expect(page.getByText("Your booking is confirmed.")).toBeVisible();
  await expect(
    page.locator(".booking-complete .booking-seat-details"),
  ).toContainText("VIP Left · Row A · Seat 1");
  const booking = await page.evaluate(
    async () => (await (await fetch("/api/demo/records")).json()).bookings[0],
  );
  if (
    booking.lineItems.length !== 2 ||
    booking.lineItems[0].categoryName !== "VIP" ||
    booking.lineItems[0].price !== 170 ||
    booking.lineItems[1].row !== null ||
    booking.total !== 225.75
  )
    throw new Error(
      "Mixed-category seat metadata or fee calculation was not preserved.",
    );
  await page
    .locator("dialog[open]")
    .getByRole("link", { name: "My Tickets", exact: true })
    .click();
  await expect(
    page.locator(".showcase-ticket .booking-seat-details"),
  ).toContainText("VIP Left · Row A · Seat 1");
  await page.goto(`${base}/tickets`);
  await expect(page.locator(".showcase-ticket")).toContainText(
    "General Admission Rear",
  );
  await open(page);
  await zone(page, "VIP Left").click();
  await expect(seat(page, "VIP Left", "A", 1, "sold")).toBeDisabled();
  await back(page);
  await zone(page, "Silver Left").click();
  await expect(
    page.getByRole("button", {
      name: /Silver Left, Row A, Seat 1, available, accessible/,
    }),
  ).toBeEnabled();
  await seat(page, "Silver Left", "A", 1, "available").click();
  await page.getByRole("button", { name: "Close seat selection" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Select Seats", exact: true }).click();
  await expect(page.locator(".venue-total")).toContainText("78.75");
  const second = await context.newPage();
  watch(second);
  await open(second);
  await zone(second, "Silver Left").click();
  await expect(
    second.getByRole("button", {
      name: /Silver Left, Row A, Seat 1, held, accessible/,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(
    second.getByRole("button", {
      name: /Silver Left, Row A, Seat 1, available, accessible/,
    }),
  ).toBeEnabled();
  await second.close();

  // Organizer edits are persisted, but event pricing is not shared between concerts.
  await page.getByRole("button", { name: "Close seat selection" }).click();
  await page.goto(`${base}/organizer`);
  await page.getByLabel("Price for vip", { exact: true }).fill("180");
  await page
    .getByLabel("Category name vip", { exact: true })
    .fill("VIP Reserved");
  await page
    .getByLabel("Color for VIP Reserved", { exact: true })
    .fill("#c099ff");
  await page
    .getByRole("button", { name: "Save Seating Configuration" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Seating configuration saved.",
  );
  await page.reload();
  await expect(page.getByLabel("Price for vip", { exact: true })).toHaveValue(
    "180",
  );
  await page
    .getByLabel("Concert", { exact: true })
    .selectOption("midnight-echoes");
  await expect(
    page.getByLabel("Category name vip", { exact: true }),
  ).toHaveValue("VIP Reserved");
  await expect(page.getByLabel("Price for vip", { exact: true })).toHaveValue(
    "150",
  );
  await page.getByLabel("Concert", { exact: true }).selectOption("neon-nights");
  await page.getByLabel("Manage inventory section").selectOption("gold-center");
  await seat(page, "Gold Center", "A", 1, "available").click();
  await page.reload();
  await page.getByLabel("Manage inventory section").selectOption("gold-center");
  await expect(seat(page, "Gold Center", "A", 1, "blocked")).toBeEnabled();
  await page
    .getByLabel("Allow tickets from multiple categories in one booking")
    .uncheck();
  await page
    .getByRole("button", { name: "Save Seating Configuration" })
    .click();
  await open(page);
  await zone(page, "VVIP Front").click();
  await seat(page, "VVIP Front", "A", 1, "available").click();
  await back(page);
  await zone(page, "VIP Left").click();
  await seat(page, "VIP Left", "A", 2, "available").click();
  await expect(page.locator(".seat-error")).toContainText(
    "one category per booking",
  );
  await page.getByRole("button", { name: "Clear selection" }).click();
  await back(page);
  await zone(page, "Gold Center").click();
  await expect(seat(page, "Gold Center", "A", 1, "blocked")).toBeDisabled();
  await page.getByRole("button", { name: "Close seat selection" }).click();
  await page.goto(`${base}/organizer`);
  await page.getByRole("button", { name: "Add Ticket Category" }).click();
  const newRow = page.locator(".manager-category-row").last();
  await newRow
    .locator('input:not([type="color"]):not([type="number"])')
    .fill("Balcony");
  await newRow.locator('input[type="number"]').fill("30");
  await page.locator(".venue-layout-editor summary").click();
  await page.getByRole("button", { name: "Add Section", exact: true }).click();
  await page.getByLabel("Section name", { exact: true }).fill("Balcony Rear");
  const categoryId = await newRow
    .locator('input[type="number"]')
    .getAttribute("aria-label");
  await page
    .getByLabel("Section category", { exact: true })
    .selectOption(categoryId.replace("Price for ", ""));
  await page
    .getByLabel("Seating type", { exact: true })
    .selectOption("general");
  await page.getByLabel("General admission capacity").fill("20");
  await page.getByLabel("Left (%)", { exact: true }).fill("6");
  await page
    .getByRole("button", { name: "Save Seating Configuration" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Seating configuration saved.",
  );
  await page.reload();
  await expect(page.locator(".manager-categories")).toContainText("20 tickets");
  await open(page);
  await expect(zone(page, "Balcony Rear")).toContainText("30.00 USDC");
  await expect(zone(page, "VIP Left")).toHaveCSS("color", "rgb(192, 153, 255)");
  const position = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("fairtix-seating-v1"))
        .venues.find((v) => v.id === "harbor")
        .sections.find((s) => s.name === "Balcony Rear").x,
  );
  if (position !== 6)
    throw new Error("Organizer section position was not persisted.");
  await zone(page, "Balcony Rear").click();
  await page
    .getByRole("button", { name: "Add a ticket from Balcony Rear" })
    .click();
  await expect(page.locator(".venue-total")).toContainText("31.50");
  await page.getByRole("button", { name: "Clear selection" }).click();
  await page.getByRole("button", { name: "Close seat selection" }).click();

  // Different venues keep their own geometry and prices.
  await open(page, "golden-hour");
  await expect(page.locator(".venue-zone")).toHaveCount(6);
  await expect(zone(page, "VVIP Front")).toContainText("140.00 USDC");
  await page.getByRole("button", { name: "Close seat selection" }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const horizontal = await page
      .locator("dialog[open]")
      .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    if (horizontal) throw new Error(`Modal overflow at ${width}px`);
    if (width < 760) {
      const box = await page
        .getByRole("button", { name: "Continue to Checkout" })
        .boundingBox();
      if (!box || box.y + box.height > 900)
        throw new Error(
          "Mobile checkout button is not fixed within the viewport.",
        );
    }
    await zone(page, "VIP Left").click();
    await page.getByRole("button", { name: "Zoom in seats" }).click();
    await expect(
      page.getByRole("button", { name: "Back to Venue Map", exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close seat selection" }).click();
  }

  // Expiration removes selected tickets, prevents checkout, and permits a new hold.
  await page.clock.install();
  await open(page);
  await zone(page, "VVIP Front").click();
  await seat(page, "VVIP Front", "A", 1, "available").click();
  await page.clock.fastForward(301000);
  await expect(
    page.getByRole("button", { name: "Continue to Checkout" }),
  ).toBeDisabled();
  await expect(page.locator(".seat-error")).toContainText("expired");
  await seat(page, "VVIP Front", "A", 1, "available").click();
  await expect(
    page.getByRole("button", { name: "Continue to Checkout" }),
  ).toBeEnabled();
  // Keep the authorized context available for fixture cleanup.
  const legacyContext = await browser.newContext();
  await legacyContext.addInitScript(() =>
    localStorage.setItem(
      "fairtix-showcase-v1",
      JSON.stringify({
        saved: [],
        bookings: [
          {
            id: "DEMO-0001",
            eventId: "neon-nights",
            wallet: "ana",
            category: "VIP",
            seats: ["VIP-A1"],
            subtotal: 112.5,
            fee: 5.63,
            total: 118.13,
            status: "demo-confirmed",
            createdAt: "2026-10-25T05:00:00.000Z",
          },
        ],
      }),
    ),
  );
  const legacyPage = await legacyContext.newPage();
  watch(legacyPage);
  await open(legacyPage);
  await expect
    .poll(() =>
      legacyPage.evaluate(() => localStorage.getItem("fairtix-showcase-v1")),
    )
    .toBeNull();
  await legacyPage
    .getByLabel("Tickets and wallet menu", { exact: true })
    .click();
  await expect(
    legacyPage.getByRole("link", { name: "Sign In", exact: true }),
  ).toHaveCount(0);
  await legacyContext.close();
  if (errors.length) throw new Error([...new Set(errors)].join("\n"));
  console.log(
    "PASS: full map, category colors/prices, mixed sections, GA, fees, removal, sold/held/blocked/accessibility, persistence, two-tab holds, organizer prices/names/capacity/sections, event isolation, tickets/history, responsive modal, zoom, expiry and re-selection.",
  );
} finally {
  if (fixtureContext) {
    try {
      for (const p of fixtureContext.pages()) {
        const session = await p
          .evaluate(() => sessionStorage.getItem("fairtix-seating-v1"))
          .catch(() => null);
        if (session)
          await fixtureContext.request.post(`${base}/api/demo/holds/release`, {
            data: { session },
            headers: { Origin: base },
          });
      }
      await fixtureContext.request.post(`${base}/api/demo/reset`, {
        data: {},
        headers: { Origin: base },
      });
      if (initialConfig)
        for (const event of initialConfig.events)
          await fixtureContext.request.post(
            `${base}/api/demo/organizer/config`,
            {
              data: {
                event,
                venue: initialConfig.venues.find((v) => v.id === event.venueId),
              },
              headers: { Origin: base },
            },
          );
    } catch {}
  }
  await browser.close();
}
