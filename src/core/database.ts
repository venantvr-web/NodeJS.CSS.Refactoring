/**
 * Database layer using lowdb for persistence
 */
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import {
  DatabaseSchema,
  URLRecord,
  ScanHistory,
  PageStatus,
  CSSError,
  AnalysisSnapshot,
} from './types.js';

const DB_PATH = path.join(process.cwd(), 'css-audit-data.json');

class Database {
  private db: Low<DatabaseSchema> | null = null;

  async init(): Promise<void> {
    const adapter = new JSONFile<DatabaseSchema>(DB_PATH);
    this.db = new Low(adapter, this.getDefaultData());
    await this.db.read();

    // Initialize with defaults if empty
    if (!this.db.data.urls) {
      this.db.data = this.getDefaultData();
      await this.db.write();
    }
  }

  private getDefaultData(): DatabaseSchema {
    return {
      urls: [],
      config: {
        baseUrl: '',
        monitoringEnabled: false,
        scanInterval: 5, // 5 minutes default
        excludedUrls: [],
        lastScan: 0,
        hostResolverRules: '', // DNS resolver rules
        customBrowserArgs: [], // Custom browser arguments
      },
      history: [],
    };
  }

  private ensureInit(): Low<DatabaseSchema> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // ===== URL Management =====

  async getURL(url: string): Promise<URLRecord | undefined> {
    const db = this.ensureInit();
    await db.read();
    return db.data.urls.find((u) => u.url === url);
  }

  async getAllURLs(): Promise<URLRecord[]> {
    const db = this.ensureInit();
    await db.read();
    return db.data.urls;
  }

  async addOrUpdateURL(urlRecord: Partial<URLRecord> & { url: string }): Promise<URLRecord> {
    const db = this.ensureInit();
    await db.read();

    const existingIndex = db.data.urls.findIndex((u) => u.url === urlRecord.url);
    const now = Date.now();

    if (existingIndex >= 0) {
      // Update existing
      const existing = db.data.urls[existingIndex];
      const updated: URLRecord = {
        ...existing,
        ...urlRecord,
        lastScanned: now,
        scanCount: existing.scanCount + 1,
      };
      db.data.urls[existingIndex] = updated;
      await db.write();
      return updated;
    } else {
      // Add new
      const newRecord: URLRecord = {
        url: urlRecord.url,
        domain: new URL(urlRecord.url).hostname,
        path: new URL(urlRecord.url).pathname,
        firstSeen: now,
        lastScanned: now,
        scanCount: 1,
        status: urlRecord.status || PageStatus.PENDING,
        excluded: urlRecord.excluded || false,
        errors: urlRecord.errors || [],
        errorCount: urlRecord.errorCount || 0,
        healthScore: urlRecord.healthScore || 100,
        analysisHistory: urlRecord.analysisHistory || [],
      };
      db.data.urls.push(newRecord);
      await db.write();
      return newRecord;
    }
  }

  async updateURLErrors(url: string, errors: CSSError[], harPath?: string): Promise<void> {
    const db = this.ensureInit();
    await db.read();

    const urlIndex = db.data.urls.findIndex((u) => u.url === url);
    if (urlIndex >= 0) {
      const urlRecord = db.data.urls[urlIndex];
      urlRecord.errors = errors;
      urlRecord.errorCount = errors.length;
      urlRecord.healthScore = this.calculateHealthScore(errors);

      // Update HAR path if provided
      if (harPath) {
        urlRecord.harPath = harPath;
      }

      // Add to history
      const snapshot: AnalysisSnapshot = {
        timestamp: Date.now(),
        errorCount: errors.length,
        healthScore: urlRecord.healthScore,
        errors,
        harPath,
      };
      urlRecord.analysisHistory.push(snapshot);

      // Keep only last 50 snapshots
      if (urlRecord.analysisHistory.length > 50) {
        urlRecord.analysisHistory = urlRecord.analysisHistory.slice(-50);
      }

      await db.write();
    }
  }

  async excludeURL(url: string, excluded: boolean): Promise<void> {
    const db = this.ensureInit();
    await db.read();

    const urlIndex = db.data.urls.findIndex((u) => u.url === url);
    if (urlIndex >= 0) {
      db.data.urls[urlIndex].excluded = excluded;
      db.data.urls[urlIndex].status = excluded ? PageStatus.EXCLUDED : PageStatus.PENDING;
      await db.write();
    }
  }

  async clearURLs(): Promise<void> {
    const db = this.ensureInit();
    await db.read();
    db.data.urls = [];
    await db.write();
  }

  async deleteURL(url: string): Promise<void> {
    const db = this.ensureInit();
    await db.read();
    db.data.urls = db.data.urls.filter((u) => u.url !== url);
    await db.write();
  }

  async deleteURLs(urls: string[]): Promise<void> {
    const db = this.ensureInit();
    await db.read();
    const urlSet = new Set(urls);
    db.data.urls = db.data.urls.filter((u) => !urlSet.has(u.url));
    await db.write();
  }

  // ===== Configuration =====

  async getConfig() {
    const db = this.ensureInit();
    await db.read();
    return db.data.config;
  }

  async updateConfig(config: Partial<DatabaseSchema['config']>): Promise<void> {
    const db = this.ensureInit();
    await db.read();
    db.data.config = { ...db.data.config, ...config };
    await db.write();
  }

  async setMonitoringEnabled(enabled: boolean): Promise<void> {
    await this.updateConfig({ monitoringEnabled: enabled });
  }

  async setScanInterval(minutes: number): Promise<void> {
    await this.updateConfig({ scanInterval: minutes });
  }

  async setBaseUrl(baseUrl: string): Promise<void> {
    await this.updateConfig({ baseUrl });
  }

  // ===== History =====

  async addScanHistory(history: Omit<ScanHistory, 'id'>): Promise<void> {
    const db = this.ensureInit();
    await db.read();

    const record: ScanHistory = {
      ...history,
      id: `scan_${Date.now()}`,
    };

    db.data.history.push(record);

    // Keep only last 100 scans
    if (db.data.history.length > 100) {
      db.data.history = db.data.history.slice(-100);
    }

    await db.write();
  }

  async getHistory(limit: number = 20): Promise<ScanHistory[]> {
    const db = this.ensureInit();
    await db.read();
    return db.data.history.slice(-limit).reverse();
  }

  // ===== Statistics =====

  async getStats() {
    const db = this.ensureInit();
    await db.read();

    const urls = db.data.urls;
    const totalUrls = urls.length;
    const excludedUrls = urls.filter((u) => u.excluded).length;
    const activeUrls = totalUrls - excludedUrls;
    const totalErrors = urls.reduce((sum, u) => sum + u.errorCount, 0);
    const avgHealthScore =
      activeUrls > 0 ? urls.filter((u) => !u.excluded).reduce((sum, u) => sum + u.healthScore, 0) / activeUrls : 100;

    return {
      totalUrls,
      excludedUrls,
      activeUrls,
      totalErrors,
      avgHealthScore,
      lastScan: db.data.config.lastScan,
    };
  }

  // ===== Utilities =====

  private calculateHealthScore(errors: CSSError[]): number {
    if (errors.length === 0) return 100;

    const weights = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 2,
    };

    let penalty = 0;
    errors.forEach((error) => {
      penalty += weights[error.severity] || 0;
    });

    const score = Math.max(0, 100 - penalty);
    return Math.round(score);
  }
}

export const database = new Database();
