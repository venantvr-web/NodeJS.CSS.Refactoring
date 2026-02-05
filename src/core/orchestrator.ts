/**
 * Orchestrator - coordinates crawling, analysis, and monitoring
 */
import { PageCrawler } from '../crawler/page-crawler.js';
import { CSSAnalyzer } from '../analyzers/css-analyzer.js';
import { database } from './database.js';
import { log } from './logger.js';
import { CSSAuditConfig, PageStatus, ScanHistory } from './types.js';
import { EventEmitter } from 'events';

export class Orchestrator extends EventEmitter {
  private crawler: PageCrawler;
  private analyzer: CSSAnalyzer;
  private config: CSSAuditConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;

  constructor(config: CSSAuditConfig) {
    super();
    this.config = config;
    this.crawler = new PageCrawler(config.crawler);
    this.analyzer = new CSSAnalyzer();
  }

  /**
   * Run a single scan of the website
   */
  async scan(): Promise<void> {
    if (this.isScanning) {
      log.warn('Scan already in progress, skipping');
      return;
    }

    this.isScanning = true;
    const startTime = Date.now();

    try {
      log.info('Starting website scan');
      this.emit('scan:started');

      // Get config from database to get latest DNS settings
      const dbConfig = await database.getConfig();
      const baseUrl = this.config.baseUrl || dbConfig.baseUrl;

      if (!baseUrl) {
        throw new Error('No base URL configured');
      }

      // Recreate crawler with updated config from database
      // This ensures DNS resolver rules and custom browser args are up-to-date
      const updatedCrawlerConfig = {
        ...this.config.crawler,
        hostResolverRules: dbConfig.hostResolverRules || '',
        customBrowserArgs: dbConfig.customBrowserArgs || [],
      };

      this.crawler = new PageCrawler(updatedCrawlerConfig);
      log.info('Crawler reinitialized with latest DNS configuration');

      // Discover URLs to scan
      const urlsToScan = await this.discoverURLs(baseUrl);
      log.info(`Discovered ${urlsToScan.length} URLs`);

      let scanned = 0;
      let totalErrors = 0;

      // Scan each URL
      for (const url of urlsToScan) {
        // Check if excluded
        const urlRecord = await database.getURL(url);
        if (urlRecord?.excluded) {
          log.info(`Skipping excluded URL: ${url}`);
          continue;
        }

        this.emit('scan:progress', {
          current: scanned + 1,
          total: urlsToScan.length,
          currentUrl: url,
        });

        // Crawl page
        const crawledPage = await this.crawler.crawlPage(url);

        // Analyze CSS
        const analysis = this.analyzer.analyze(crawledPage);

        // Save to database
        await database.addOrUpdateURL({
          url,
          status: crawledPage.status,
          errors: analysis.errors,
          errorCount: analysis.errors.length,
          healthScore: analysis.summary.healthScore,
        });

        await database.updateURLErrors(url, analysis.errors, crawledPage.harPath);

        totalErrors += analysis.errors.length;
        scanned++;

        this.emit('page:analyzed', {
          url,
          errorCount: analysis.errors.length,
          healthScore: analysis.summary.healthScore,
          status: crawledPage.status,
        });

        log.info(
          `Analyzed ${url}: ${analysis.errors.length} errors, health: ${analysis.summary.healthScore}`
        );
      }

      // Update config
      await database.updateConfig({ lastScan: Date.now() });

      // Add to history
      const duration = Date.now() - startTime;
      const history: Omit<ScanHistory, 'id'> = {
        timestamp: Date.now(),
        urlsScanned: scanned,
        totalErrors,
        duration,
        summary: {
          totalErrors,
          errorsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          errorsByType: {} as any,
          healthScore: 0,
          status: 'healthy',
        },
      };
      await database.addScanHistory(history);

      this.emit('scan:completed', {
        urlsScanned: scanned,
        totalErrors,
        duration,
      });

      log.info(`Scan completed: ${scanned} URLs, ${totalErrors} total errors`);
    } catch (error) {
      log.error('Scan failed:', error);
      this.emit('scan:error', error);
      throw error;
    } finally {
      this.isScanning = false;
      await this.crawler.close();
    }
  }

  /**
   * Discover URLs from base URL
   */
  private async discoverURLs(baseUrl: string): Promise<string[]> {
    const discovered = new Set<string>();
    const toVisit = [baseUrl];
    const visited = new Set<string>();
    const maxPages = this.config.maxPages || 50;

    log.info(`Starting URL discovery from ${baseUrl} (max: ${maxPages} pages)`);

    while (toVisit.length > 0 && discovered.size < maxPages) {
      const currentUrl = toVisit.shift()!;

      if (visited.has(currentUrl)) {
        continue;
      }

      visited.add(currentUrl);
      discovered.add(currentUrl);

      try {
        // Discover links from this page
        const links = await this.crawler.discoverLinks(currentUrl);

        for (const link of links) {
          if (!visited.has(link) && !toVisit.includes(link)) {
            toVisit.push(link);
          }
        }

        log.info(`Discovered ${links.length} links from ${currentUrl}`);
      } catch (error) {
        log.error(`Failed to discover links from ${currentUrl}:`, error);
      }

      // Limit discovery phase
      if (discovered.size >= maxPages) {
        log.info(`Reached max pages limit (${maxPages})`);
        break;
      }
    }

    const finalUrls = Array.from(discovered);
    log.info(`URL discovery complete: ${finalUrls.length} URLs found`);

    return finalUrls;
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(intervalMinutes: number): Promise<void> {
    if (this.monitoringInterval) {
      log.warn('Monitoring already running');
      return;
    }

    log.info(`Starting continuous monitoring (interval: ${intervalMinutes} minutes)`);

    // Run initial scan
    await this.scan();

    // Schedule recurring scans
    this.monitoringInterval = setInterval(async () => {
      log.info('Running scheduled scan');
      await this.scan();
    }, intervalMinutes * 60 * 1000);

    await database.setMonitoringEnabled(true);
    await database.setScanInterval(intervalMinutes);
  }

  /**
   * Stop continuous monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      await database.setMonitoringEnabled(false);
      log.info('Monitoring stopped');
    }
  }

  /**
   * Check if monitoring is running
   */
  isMonitoring(): boolean {
    return this.monitoringInterval !== null;
  }

  /**
   * Exclude/include a URL
   */
  async setURLExcluded(url: string, excluded: boolean): Promise<void> {
    await database.excludeURL(url, excluded);
    log.info(`URL ${url} ${excluded ? 'excluded' : 'included'}`);
    this.emit('url:excluded', { url, excluded });
  }

  /**
   * Scan specific URLs (for agent-based scanning)
   */
  async scanSpecificURLs(urls: string[]): Promise<void> {
    if (this.isScanning) {
      throw new Error('Scan already in progress');
    }

    this.isScanning = true;
    const startTime = Date.now();

    try {
      log.info(`Starting agent scan for ${urls.length} URLs`);
      this.emit('scan:started');

      // Get config from database to get latest DNS settings
      const dbConfig = await database.getConfig();

      // Recreate crawler with updated config from database
      const updatedCrawlerConfig = {
        ...this.config.crawler,
        hostResolverRules: dbConfig.hostResolverRules || '',
        customBrowserArgs: dbConfig.customBrowserArgs || [],
      };

      this.crawler = new PageCrawler(updatedCrawlerConfig);
      log.info('Crawler reinitialized with latest DNS configuration');

      let scanned = 0;
      let totalErrors = 0;

      // Scan each URL
      for (const url of urls) {
        // Check if excluded
        const urlRecord = await database.getURL(url);
        if (urlRecord?.excluded) {
          log.info(`Skipping excluded URL: ${url}`);
          continue;
        }

        this.emit('scan:progress', {
          current: scanned + 1,
          total: urls.length,
          currentUrl: url,
        });

        // Crawl page
        const crawledPage = await this.crawler.crawlPage(url);

        // Analyze CSS
        const analysis = this.analyzer.analyze(crawledPage);

        // Save to database
        await database.addOrUpdateURL({
          url,
          status: crawledPage.status,
          errors: analysis.errors,
          errorCount: analysis.errors.length,
          healthScore: analysis.summary.healthScore,
        });

        await database.updateURLErrors(url, analysis.errors, crawledPage.harPath);

        totalErrors += analysis.errors.length;
        scanned++;

        this.emit('page:analyzed', {
          url,
          errorCount: analysis.errors.length,
          healthScore: analysis.summary.healthScore,
          status: crawledPage.status,
        });

        log.info(
          `Analyzed ${url}: ${analysis.errors.length} errors, health: ${analysis.summary.healthScore}`
        );
      }

      // Update config
      await database.updateConfig({ lastScan: Date.now() });

      // Add to history
      const duration = Date.now() - startTime;
      const history: Omit<ScanHistory, 'id'> = {
        timestamp: Date.now(),
        urlsScanned: scanned,
        totalErrors,
        duration,
        summary: {
          totalErrors,
          errorsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
          errorsByType: {} as any,
          healthScore: 0,
          status: 'healthy',
        },
      };
      await database.addScanHistory(history);

      this.emit('scan:completed', {
        urlsScanned: scanned,
        totalErrors,
        duration,
      });

      log.info(`Agent scan completed: ${scanned} URLs, ${totalErrors} total errors`);
    } catch (error) {
      log.error('Agent scan failed:', error);
      this.emit('scan:error', error);
      throw error;
    } finally {
      this.isScanning = false;
      await this.crawler.close();
    }
  }

  /**
   * Check if a scan is currently running
   */
  isScanRunning(): boolean {
    return this.isScanning;
  }
}
