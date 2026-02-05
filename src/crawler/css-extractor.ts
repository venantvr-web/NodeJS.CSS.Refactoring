/**
 * CSS Extraction from pages
 */
import { Page } from 'playwright';
import { ExtractedCSS } from '../core/types.js';

export class CSSExtractor {
  async extract(page: Page): Promise<ExtractedCSS> {
    const extracted: ExtractedCSS = {
      inline: [],
      external: [],
      inlineStyles: [],
      cssText: '',
    };

    try {
      // Extract inline style tags
      const styleTags = await page.evaluate(() => {
        const styles = Array.from(document.querySelectorAll('style'));
        return styles.map((style) => style.textContent || '');
      });
      extracted.inline = styleTags.filter((s) => s.trim().length > 0);

      // Extract external stylesheet URLs
      const linkHrefs = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        return links.map((link) => (link as HTMLLinkElement).href);
      });
      extracted.external = linkHrefs;

      // Extract inline styles from style attributes
      const inlineStyles = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('[style]'));
        return elements
          .map((el) => el.getAttribute('style') || '')
          .filter((s) => s.trim().length > 0);
      });
      extracted.inlineStyles = inlineStyles;

      // Get all applied CSS using CSSOM
      const allCSS = await page.evaluate(() => {
        let css = '';
        try {
          for (let i = 0; i < document.styleSheets.length; i++) {
            const sheet = document.styleSheets[i];
            try {
              const rules = sheet.cssRules || sheet.rules;
              for (let j = 0; j < rules.length; j++) {
                css += rules[j].cssText + '\n';
              }
            } catch (e) {
              // Cross-origin stylesheets will throw
            }
          }
        } catch (e) {
          // Handle errors
        }
        return css;
      });

      extracted.cssText = allCSS;
    } catch (error) {
      // Log error but don't throw
    }

    return extracted;
  }

  extractVariables(cssText: string): { declared: string[]; used: string[] } {
    const declared = new Set<string>();
    const used = new Set<string>();

    const declaredRegex = /--([\w-]+)\s*:/g;
    let match;
    while ((match = declaredRegex.exec(cssText)) !== null) {
      declared.add(`--${match[1]}`);
    }

    const usedRegex = /var\(\s*--([\w-]+)/g;
    while ((match = usedRegex.exec(cssText)) !== null) {
      used.add(`--${match[1]}`);
    }

    return {
      declared: Array.from(declared),
      used: Array.from(used),
    };
  }

  async isSelectorUsed(page: Page, selector: string): Promise<boolean> {
    try {
      const count = await page.evaluate((sel) => {
        try {
          return document.querySelectorAll(sel).length;
        } catch {
          return 0;
        }
      }, selector);
      return count > 0;
    } catch {
      return false;
    }
  }
}
