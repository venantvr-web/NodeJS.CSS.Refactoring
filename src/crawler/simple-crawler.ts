/**
 * Simple HTTP Crawler (fallback for Node 16 - no Playwright needed)
 */
import https from 'https';
import http from 'http';
import { parse as parseUrl } from 'url';
import { load } from 'cheerio';
import { CrawlerConfig, CrawledPage, ExtractedCSS, PageStatus } from '../core/types.js';
import { log } from '../core/logger.js';

export class SimpleCrawler {
  private config: CrawlerConfig;

  constructor(config: CrawlerConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    log.info('Simple HTTP Crawler initialized (Node 16 compatible)');
  }

  async close(): Promise<void> {
    // Nothing to close
  }

  async crawlPage(url: string): Promise<CrawledPage> {
    try {
      log.info(`Crawling (HTTP): ${url}`);

      const html = await this.fetchUrl(url);
      const $ = load(html);

      // Extract CSS
      const css: ExtractedCSS = {
        inline: [],
        external: [],
        inlineStyles: [],
        cssText: '',
      };

      // Inline style tags
      $('style').each((_, el) => {
        const content = $(el).html() || '';
        if (content.trim()) {
          css.inline.push(content);
          css.cssText += content + '\n';
        }
      });

      // External stylesheets
      $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          css.external.push(this.resolveUrl(url, href));
        }
      });

      // Inline styles
      $('[style]').each((_, el) => {
        const style = $(el).attr('style');
        if (style && style.trim()) {
          css.inlineStyles.push(style);
        }
      });

      // Fetch external stylesheets
      for (const cssUrl of css.external.slice(0, 5)) {
        // Limit to 5
        try {
          const cssContent = await this.fetchUrl(cssUrl);
          css.cssText += cssContent + '\n';
        } catch (e) {
          log.warn(`Failed to fetch CSS: ${cssUrl}`);
        }
      }

      return {
        url,
        timestamp: Date.now(),
        css,
        errors: [],
        status: PageStatus.SUCCESS,
      };
    } catch (error: any) {
      log.error(`Error crawling ${url}:`, error.message);

      return {
        url,
        timestamp: Date.now(),
        css: { inline: [], external: [], inlineStyles: [], cssText: '' },
        errors: [],
        status: PageStatus.ERROR,
      };
    }
  }

  async discoverLinks(baseUrl: string): Promise<string[]> {
    try {
      const html = await this.fetchUrl(baseUrl);
      const $ = load(html);
      const links = new Set<string>();
      const baseHost = new URL(baseUrl).hostname;

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          try {
            const fullUrl = this.resolveUrl(baseUrl, href);
            const url = new URL(fullUrl);
            if (url.hostname === baseHost) {
              links.add(fullUrl);
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
      });

      return Array.from(links);
    } catch (error) {
      log.error('Error discovering links:', error);
      return [baseUrl];
    }
  }

  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = parseUrl(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        headers: {
          'User-Agent': this.config.userAgent,
        },
        timeout: this.config.timeout,
      };

      const req = protocol.get(url, options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Handle redirect
          const location = res.headers.location;
          if (location) {
            this.fetchUrl(this.resolveUrl(url, location))
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  private resolveUrl(base: string, relative: string): string {
    try {
      return new URL(relative, base).href;
    } catch {
      return relative;
    }
  }
}
