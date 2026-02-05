/**
 * CSS Analysis - detect errors and issues
 */
import { CSSExtractor } from '../crawler/css-extractor.js';
import {
  CSSError,
  CSSErrorType,
  ErrorSeverity,
  AnalysisResult,
  AnalysisSummary,
  CrawledPage,
  CSSVariablesReport,
} from '../core/types.js';
import postcss from 'postcss';
import { isWordPressVariable, getWordPressSuggestion } from './css-variables/known-wordpress-variables.js';

export class CSSAnalyzer {
  private cssExtractor: CSSExtractor;

  constructor() {
    this.cssExtractor = new CSSExtractor();
  }

  analyze(crawledPage: CrawledPage): AnalysisResult {
    const errors: CSSError[] = [];

    // Analyze CSS variables
    const variablesReport = this.analyzeVariables(crawledPage.css.cssText);
    errors.push(...this.getVariableErrors(variablesReport));

    // Analyze selectors
    errors.push(...this.analyzeSelectors(crawledPage.css.cssText));

    // Calculate summary
    const summary = this.calculateSummary(errors);

    return {
      url: crawledPage.url,
      timestamp: Date.now(),
      summary,
      errors,
      cssVariables: variablesReport,
    };
  }

  private analyzeVariables(cssText: string): CSSVariablesReport {
    const { declared, used } = this.cssExtractor.extractVariables(cssText);

    const declaredSet = new Set(declared);
    const usedSet = new Set(used);

    const unused = declared.filter((v) => !usedSet.has(v));
    const unresolved = used.filter((v) => !declaredSet.has(v));

    // Find duplicates (same value, different names)
    const valueMap = new Map<string, string[]>();
    const declaredVars = declared.map((name) => {
      const match = cssText.match(new RegExp(`${name}\\s*:\\s*([^;]+)`));
      const value = match ? match[1].trim() : '';
      return { name, value, location: undefined, usageCount: 0 };
    });

    declaredVars.forEach((v) => {
      if (v.value) {
        const existing = valueMap.get(v.value) || [];
        existing.push(v.name);
        valueMap.set(v.value, existing);
      }
    });

    const duplicates = Array.from(valueMap.entries())
      .filter(([_, names]) => names.length > 1)
      .map(([value, variables]) => ({ value, variables }));

    return {
      declared: declaredVars,
      used,
      unused,
      unresolved,
      duplicates,
    };
  }

  private getVariableErrors(report: CSSVariablesReport): CSSError[] {
    const errors: CSSError[] = [];

    // Unresolved variables (used but not declared)
    report.unresolved.forEach((varName) => {
      // Skip WordPress variables entirely (no error generated)
      if (isWordPressVariable(varName)) {
        return; // Skip this variable completely
      }

      errors.push({
        id: `unresolved_${varName}_${Date.now()}`,
        type: CSSErrorType.UNRESOLVED_VARIABLE,
        severity: ErrorSeverity.HIGH,
        message: `Variable ${varName} is used but not declared`,
        details: `CSS custom property ${varName} is referenced with var() but no declaration found`,
        suggestion: `Declare ${varName} in your CSS or check for typos`,
      });
    });

    // Unused variables
    report.unused.forEach((varName) => {
      errors.push({
        id: `unused_${varName}_${Date.now()}`,
        type: CSSErrorType.UNUSED_VARIABLE,
        severity: ErrorSeverity.LOW,
        message: `Variable ${varName} is declared but never used`,
        details: `CSS custom property ${varName} is declared but not referenced`,
        suggestion: `Remove ${varName} if not needed or use it in your styles`,
      });
    });

    // Duplicate variables
    report.duplicates.forEach((dup) => {
      if (dup.variables.length > 1) {
        errors.push({
          id: `duplicate_${dup.value}_${Date.now()}`,
          type: CSSErrorType.DUPLICATE_VARIABLE,
          severity: ErrorSeverity.MEDIUM,
          message: `Multiple variables with same value`,
          details: `Variables ${dup.variables.join(', ')} all have value: ${dup.value}`,
          suggestion: `Consider using a single variable for consistency`,
        });
      }
    });

    return errors;
  }

  private analyzeSelectors(cssText: string): CSSError[] {
    const errors: CSSError[] = [];

    try {
      const root = postcss.parse(cssText);

      root.walkRules((rule) => {
        const selector = rule.selector;

        // Check for high specificity (e.g., #id .class .class)
        const idCount = (selector.match(/#/g) || []).length;
        const classCount = (selector.match(/\./g) || []).length;

        if (idCount > 1 || (idCount > 0 && classCount > 2)) {
          errors.push({
            id: `specificity_${Date.now()}_${Math.random()}`,
            type: CSSErrorType.HIGH_SPECIFICITY,
            severity: ErrorSeverity.MEDIUM,
            message: `High specificity selector`,
            details: `Selector "${selector}" has high specificity which may cause maintenance issues`,
            location: { selector },
            suggestion: `Reduce specificity by removing ID selectors or nested classes`,
          });
        }
      });
    } catch (error) {
      // Parse error
      errors.push({
        id: `parse_error_${Date.now()}`,
        type: CSSErrorType.PARSE_ERROR,
        severity: ErrorSeverity.CRITICAL,
        message: `CSS parsing error`,
        details: `Failed to parse CSS: ${error}`,
        suggestion: `Check CSS syntax for errors`,
      });
    }

    return errors;
  }

  private calculateSummary(errors: CSSError[]): AnalysisSummary {
    const errorsBySeverity = {
      critical: errors.filter((e) => e.severity === ErrorSeverity.CRITICAL).length,
      high: errors.filter((e) => e.severity === ErrorSeverity.HIGH).length,
      medium: errors.filter((e) => e.severity === ErrorSeverity.MEDIUM).length,
      low: errors.filter((e) => e.severity === ErrorSeverity.LOW).length,
    };

    const errorsByType: Record<CSSErrorType, number> = {} as any;
    Object.values(CSSErrorType).forEach((type) => {
      errorsByType[type] = errors.filter((e) => e.type === type).length;
    });

    // Calculate health score
    const weights = { critical: 20, high: 10, medium: 5, low: 2 };
    let penalty = 0;
    penalty += errorsBySeverity.critical * weights.critical;
    penalty += errorsBySeverity.high * weights.high;
    penalty += errorsBySeverity.medium * weights.medium;
    penalty += errorsBySeverity.low * weights.low;

    const healthScore = Math.max(0, Math.min(100, 100 - penalty));

    const status =
      healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical';

    return {
      totalErrors: errors.length,
      errorsBySeverity,
      errorsByType,
      healthScore,
      status,
    };
  }
}
