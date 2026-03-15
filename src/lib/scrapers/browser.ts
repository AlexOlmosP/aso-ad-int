import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import path from "path";

let browser: Browser | null = null;

function getChromiumPath(): string | undefined {
  // playwright-core doesn't auto-detect ms-playwright installations
  // Check the standard Playwright install location on Windows
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return undefined;

  const chromiumPath = path.join(
    localAppData,
    "ms-playwright",
    "chromium-1208",
    "chrome-win64",
    "chrome.exe"
  );
  return chromiumPath;
}

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;

  const executablePath = getChromiumPath();
  console.log(`[Browser] Launching Chromium from: ${executablePath ?? "auto-detect"}`);

  browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  return browser;
}

export async function createPage(): Promise<{ context: BrowserContext; page: Page }> {
  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });
  const page = await context.newPage();
  return { context, page };
}
