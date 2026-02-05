/**
 * Page Crawler using Playwright
 */
import { CSSExtractor } from './css-extractor.js';
import { CrawlerConfig, CrawledPage, ExtractedCSS, PageStatus } from '../core/types.js';
import { log } from '../core/logger.js';
import path from 'path';
import fs from 'fs';

// Dynamic import to avoid Node version check at startup
let playwrightModule: any = null;
async function getPlaywright() {
  if (!playwrightModule) {
    try {
      playwrightModule = await import('playwright');
    } catch (error: any) {
      if (error.message?.includes('Node.js')) {
        throw new Error('Playwright requires Node.js 18+. Current version is too old. Please upgrade Node.js.');
      }
      throw error;
    }
  }
  return playwrightModule;
}

// Sanitize filename for safe filesystem usage
function sanitizeFilename(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]/gi, '_')
    .substring(0, 100); // Limit length
}

// Ensure HAR directory exists
function ensureHarDirectory(): string {
  const harDir = path.join(process.cwd(), 'har');
  if (!fs.existsSync(harDir)) {
    fs.mkdirSync(harDir, { recursive: true });
    log.info('Created har/ directory');
  }
  return harDir;
}

export class PageCrawler {
  private browser: any = null;
  private cssExtractor: CSSExtractor;
  private config: CrawlerConfig;

  constructor(config: CrawlerConfig) {
    this.config = config;
    this.cssExtractor = new CSSExtractor();
  }

  async init(): Promise<void> {
    if (!this.browser) {
      const playwright = await getPlaywright();

      // Build browser args dynamically
      const baseArgs = [
        '--disable-features=IsolateOrigins,site-per-process', // Disable site isolation for better /etc/hosts compatibility
        '--disable-blink-features=AutomationControlled', // Avoid detection
        '--no-sandbox', // Useful for Docker/restricted environments
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security', // Allow cross-origin requests (dev only)
        '--disable-features=VizDisplayCompositor',
      ];

      // Add host resolver rules if configured
      if (this.config.hostResolverRules) {
        baseArgs.push(`--host-resolver-rules=${this.config.hostResolverRules}`);
        log.info(`DNS resolver rules: ${this.config.hostResolverRules}`);
      }

      // Add custom browser args if provided
      if (this.config.customBrowserArgs && this.config.customBrowserArgs.length > 0) {
        baseArgs.push(...this.config.customBrowserArgs);
        log.info(`Custom browser args: ${this.config.customBrowserArgs.join(', ')}`);
      }

      this.browser = await playwright.chromium.launch({
        headless: true,
        args: baseArgs,
      });

      log.info(`Browser launched with ${baseArgs.length} arguments`);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      log.info('Browser closed');
    }
  }

  async crawlPage(url: string): Promise<CrawledPage> {
    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Prepare HAR file path
    const harDir = ensureHarDirectory();
    const timestamp = Date.now();
    const sanitizedUrl = sanitizeFilename(url);
    const harPath = path.join(harDir, `${timestamp}-${sanitizedUrl}.har`);

    const context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      ignoreHTTPSErrors: true, // Allow self-signed or invalid SSL certificates
      recordHar: {
        path: harPath,
        mode: 'minimal', // 'minimal' | 'full' - minimal excludes response bodies
      },
    });

    const page = await context.newPage();

    try {
      log.info(`Crawling: ${url}`);

      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded', // Less strict than 'networkidle', waits for DOM ready
        timeout: this.config.timeout || 60000, // Default 60s if not configured
      });

      if (!response) {
        throw new Error('No response from page');
      }

      const status = response.status();
      if (status === 404) {
        await context.close();
        return {
          url,
          timestamp: Date.now(),
          css: { inline: [], external: [], inlineStyles: [], cssText: '' },
          errors: [],
          status: PageStatus.ERROR,
          harPath,
        };
      }

      // Wait for optional selector
      if (this.config.waitForSelector) {
        try {
          await page.waitForSelector(this.config.waitForSelector, {
            timeout: 5000,
          });
        } catch (e) {
          log.warn(`Wait selector ${this.config.waitForSelector} not found`);
        }
      }

      // Extract CSS
      const css = await this.cssExtractor.extract(page);

      // Close context to finalize HAR file
      await context.close();

      const crawled: CrawledPage = {
        url,
        timestamp: Date.now(),
        css,
        errors: [], // Errors will be populated by analyzers
        status: PageStatus.SUCCESS,
        harPath,
      };

      log.info(`HAR file saved: ${harPath}`);

      return crawled;
    } catch (error) {
      log.error(`Error crawling ${url}:`, error);
      await context.close();

      return {
        url,
        timestamp: Date.now(),
        css: { inline: [], external: [], inlineStyles: [], cssText: '' },
        errors: [],
        status: PageStatus.ERROR,
        harPath,
      };
    }
  }

  async discoverLinks(baseUrl: string): Promise<string[]> {
    await this.init();

    if (!this.browser) {
      log.error('Browser not initialized for link discovery');
      return [];
    }

    const context = await this.browser.newContext({
      viewport: this.config.viewport,
      userAgent: this.config.userAgent,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    try {
      log.info(`Discovering links from: ${baseUrl}`);

      await page.goto(baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout || 60000,
      });

      const links = await page.evaluate((base: string) => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        const baseHost = new URL(base).hostname;

        return anchors
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => {
            try {
              const url = new URL(href);
              return url.hostname === baseHost;
            } catch {
              return false;
            }
          });
      }, baseUrl);

      await context.close();

      return Array.from(new Set(links));
    } catch (error) {
      log.error('Error discovering links:', error);
      await context.close();
      return [];
    }
  }
}
