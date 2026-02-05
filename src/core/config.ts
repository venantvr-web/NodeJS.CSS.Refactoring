/**
 * Configuration management
 */
import { CSSAuditConfig } from './types.js';

export const defaultConfig: CSSAuditConfig = {
  baseUrl: '',
  maxPages: 10,
  scanInterval: 5, // minutes
  crawler: {
    timeout: 60000, // 60 seconds - increased for slow-loading sites
    viewport: {
      width: 1920,
      height: 1080,
    },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    hostResolverRules: '', // Empty by default
    customBrowserArgs: [], // Empty by default
  },
  analyzers: {
    cssVariables: true,
    selectors: true,
    accessibility: true,
    specificity: true,
  },
  excludeUrls: [],
};

export function mergeConfig(partial: Partial<CSSAuditConfig>): CSSAuditConfig {
  return {
    ...defaultConfig,
    ...partial,
    crawler: {
      ...defaultConfig.crawler,
      ...(partial.crawler || {}),
    },
    analyzers: {
      ...defaultConfig.analyzers,
      ...(partial.analyzers || {}),
    },
  };
}
