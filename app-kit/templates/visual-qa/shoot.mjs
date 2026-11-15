#!/usr/bin/env node
// Screenshot an app's routes at desktop + mobile, light + dark, and run axe-core
// contrast/accessibility checks on each. Used by /app-kit:visual-qa and /app-kit:promo.
//
// Usage:
//   node shoot.mjs --base http://localhost:4173 --out .app-kit/qa --routes / /about /account
//   node shoot.mjs ... --promo   # also writes 2x-density, chrome-free shots for the promo video
//
// Writes <out>/<route>-<viewport>-<scheme>.png and <out>/report.json.

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const base = opt("base", "http://localhost:4173").replace(/\/$/, "");
const out = opt("out", ".app-kit/qa");
const promo = args.includes("--promo");
const routesStart = args.indexOf("--routes");
const routes = routesStart === -1 ? ["/"] : args.slice(routesStart + 1).filter((a) => !a.startsWith("--"));

const viewports = [
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: promo ? 2 : 1 },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: promo ? 3 : 2, isMobile: true, hasTouch: true },
];
const schemes = ["light", "dark"];

fs.mkdirSync(out, { recursive: true });
// APP_KIT_CHROME lets you reuse an existing Chrome instead of `npx playwright install chromium`.
const browser = await chromium.launch(process.env.APP_KIT_CHROME ? { executablePath: process.env.APP_KIT_CHROME } : {});
const report = { base, generatedAt: new Date().toISOString(), shots: [] };

for (const vp of viewports) {
  for (const scheme of schemes) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile ?? false,
      hasTouch: vp.hasTouch ?? false,
      colorScheme: scheme,
    });
    // shadcn/coss/heroui themes switch on a `dark` class (or data-theme), not only the media query.
    await context.addInitScript((s) => {
      const apply = () => {
        document.documentElement.classList.toggle("dark", s === "dark");
        document.documentElement.setAttribute("data-theme", s);
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
      else apply();
    }, scheme);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    for (const route of routes) {
      const slug = route === "/" ? "home" : route.replace(/^\/|\/$/g, "").replace(/[^\w-]+/g, "_");
      const file = path.join(out, `${slug}-${vp.name}-${scheme}.png`);
      const entry = { route, viewport: vp.name, scheme, file };
      try {
        await page.goto(base + route, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(400); // let entrance animations settle
        await page.screenshot({ path: file, fullPage: !promo });
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
        entry.violations = axe.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
          sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
        }));
        // Horizontal overflow is the most common mobile layout bug.
        // Compare against the configured width: mobile emulation widens innerWidth to fit content.
        entry.horizontalOverflow = await page.evaluate(
          (w) => document.documentElement.scrollWidth > w + 1,
          vp.width,
        );
      } catch (err) {
        entry.error = String(err);
      }
      entry.consoleErrors = consoleErrors.splice(0);
      report.shots.push(entry);
    }
    await context.close();
  }
}
await browser.close();

const serious = report.shots.flatMap((s) =>
  (s.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => ({ ...v, shot: s.file })),
);
report.summary = {
  shots: report.shots.length,
  errors: report.shots.filter((s) => s.error).length,
  seriousViolations: serious.length,
  contrastFailures: serious.filter((v) => v.id === "color-contrast").length,
  overflowShots: report.shots.filter((s) => s.horizontalOverflow).map((s) => s.file),
  consoleErrorShots: report.shots.filter((s) => s.consoleErrors?.length).map((s) => s.file),
};
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
