/**
 * CSS Intelligence Platform - Core Type Definitions
 */

// ===== Configuration Types =====

export interface CSSAuditConfig {
  baseUrl: string;
  maxPages?: number;
  scanInterval?: number; // minutes for continuous monitoring
  crawler: CrawlerConfig;
  analyzers: AnalyzersConfig;
  excludeUrls?: string[]; // URLs to exclude from scanning
}

export interface CrawlerConfig {
  timeout: number;
  waitForSelector?: string;
  viewport: { width: number; height: number };
  userAgent?: string;
  hostResolverRules?: string; // e.g., "MAP example.com 192.168.1.100"
  customBrowserArgs?: string[]; // Additional Chromium arguments
}

export interface AnalyzersConfig {
  cssVariables: boolean;
  selectors: boolean;
  accessibility: boolean;
  specificity: boolean;
}

// ===== Crawler Types =====

export interface CrawledPage {
  url: string;
  timestamp: number;
  css: ExtractedCSS;
  errors: CSSError[];
  status: PageStatus;
  harPath?: string; // Path to HAR file (HTTP Archive)
}

export interface ExtractedCSS {
  inline: string[]; // Inline <style> tags
  external: string[]; // External stylesheet URLs
  inlineStyles: string[]; // Inline style attributes
  cssText: string; // Combined CSS text
}

export enum PageStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  EXCLUDED = 'excluded',
  PENDING = 'pending',
}

// ===== Error Types =====

export interface CSSError {
  id: string;
  type: CSSErrorType;
  severity: ErrorSeverity;
  message: string;
  details: string;
  location?: ErrorLocation;
  suggestion?: string;
}

export enum CSSErrorType {
  UNRESOLVED_VARIABLE = 'unresolved_variable',
  UNUSED_VARIABLE = 'unused_variable',
  DUPLICATE_VARIABLE = 'duplicate_variable',
  UNUSED_SELECTOR = 'unused_selector',
  HIGH_SPECIFICITY = 'high_specificity',
  COLOR_CONTRAST = 'color_contrast',
  MISSING_FOCUS_STATE = 'missing_focus_state',
  PARSE_ERROR = 'parse_error',
}

export enum ErrorSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface ErrorLocation {
  file?: string;
  line?: number;
  column?: number;
  selector?: string;
}

// ===== Analysis Results =====

export interface AnalysisResult {
  url: string;
  timestamp: number;
  summary: AnalysisSummary;
  errors: CSSError[];
  cssVariables?: CSSVariablesReport;
  selectors?: SelectorsReport;
  accessibility?: AccessibilityReport;
  specificity?: SpecificityReport;
}

export interface AnalysisSummary {
  totalErrors: number;
  errorsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  errorsByType: Record<CSSErrorType, number>;
  healthScore: number; // 0-100
  status: 'healthy' | 'warning' | 'critical';
}

export interface CSSVariablesReport {
  declared: CSSVariable[];
  used: string[];
  unused: string[];
  unresolved: string[];
  duplicates: DuplicateVariable[];
}

export interface CSSVariable {
  name: string;
  value: string;
  location?: ErrorLocation;
  usageCount: number;
}

export interface DuplicateVariable {
  value: string;
  variables: string[];
}

export interface SelectorsReport {
  total: number;
  used: number;
  unused: SelectorInfo[];
  complex: SelectorInfo[];
}

export interface SelectorInfo {
  selector: string;
  specificity: [number, number, number];
  usageCount: number;
  location?: ErrorLocation;
}

export interface AccessibilityReport {
  colorContrast: ContrastIssue[];
  focusStates: FocusStateIssue[];
  totalIssues: number;
}

export interface ContrastIssue {
  selector: string;
  foreground: string;
  background: string;
  ratio: number;
  requiredRatio: number;
  wcagLevel: 'AA' | 'AAA';
}

export interface FocusStateIssue {
  selector: string;
  message: string;
}

export interface SpecificityReport {
  average: number;
  max: [number, number, number];
  distribution: {
    low: number; // 0-0-10
    medium: number; // 0-0-11 to 0-1-0
    high: number; // 0-1-1+
    veryHigh: number; // 1-0-0+
  };
}

// ===== Database Types =====

export interface URLRecord {
  url: string;
  domain: string;
  path: string;
  firstSeen: number;
  lastScanned: number;
  scanCount: number;
  status: PageStatus;
  excluded: boolean;
  errors: CSSError[];
  errorCount: number;
  healthScore: number;
  analysisHistory: AnalysisSnapshot[];
  harPath?: string; // Most recent HAR file path
}

export interface AnalysisSnapshot {
  timestamp: number;
  errorCount: number;
  healthScore: number;
  errors: CSSError[];
  harPath?: string; // HAR file path for this snapshot
}

export interface DatabaseSchema {
  urls: URLRecord[];
  config: {
    baseUrl: string;
    monitoringEnabled: boolean;
    scanInterval: number; // minutes
    excludedUrls: string[];
    lastScan: number;
    hostResolverRules?: string; // DNS resolver rules for browser
    customBrowserArgs?: string[]; // Custom Chromium arguments
  };
  history: ScanHistory[];
}

export interface ScanHistory {
  id: string;
  timestamp: number;
  urlsScanned: number;
  totalErrors: number;
  duration: number; // milliseconds
  summary: AnalysisSummary;
}

// ===== WebSocket Types =====

export interface WebSocketMessage {
  type: WSMessageType;
  payload: any;
}

export enum WSMessageType {
  SCAN_STARTED = 'scan_started',
  SCAN_PROGRESS = 'scan_progress',
  SCAN_COMPLETED = 'scan_completed',
  PAGE_ANALYZED = 'page_analyzed',
  ERROR_DETECTED = 'error_detected',
  CONFIG_UPDATED = 'config_updated',
  URL_EXCLUDED = 'url_excluded',
  URL_INCLUDED = 'url_included',
}

export interface ScanProgressPayload {
  current: number;
  total: number;
  currentUrl: string;
}

export interface PageAnalyzedPayload {
  url: string;
  errorCount: number;
  healthScore: number;
  status: PageStatus;
}

// ===== Server Types =====

export interface ServerConfig {
  port: number;
  host: string;
  staticDir?: string;
}

export interface MonitoringState {
  isRunning: boolean;
  interval: number; // minutes
  nextScan: number; // timestamp
  currentScan?: {
    startTime: number;
    progress: number;
    total: number;
  };
}
