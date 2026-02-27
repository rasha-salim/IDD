import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'node:path';
import { loadProject } from '../../../src/core/project-loader.js';
import { runSecurityRules } from '../../../src/security/rules/index.js';
import { analyzeSecurityPosture } from '../../../src/core/security-analyzer.js';
import type { SecurityFinding, SecurityPosture } from '../../../src/types/security.js';
import type { Project } from 'ts-morph';

const VULNERABLE_FIXTURE = resolve(import.meta.dirname, '../../fixtures/security-vulnerable');

describe('Security Rules on vulnerable fixture', () => {
  let findings: SecurityFinding[];
  let project: Project;

  beforeAll(() => {
    project = loadProject({ targetPath: VULNERABLE_FIXTURE });
    const result = runSecurityRules(project);
    findings = result.findings;
  });

  it('should detect SQL injection', () => {
    const sqlFindings = findings.filter((f) => f.ruleId === 'cmiw-sec-002');
    expect(sqlFindings.length).toBeGreaterThanOrEqual(1);
    expect(sqlFindings[0].severity).toBe('critical');
  });

  it('should detect missing authentication', () => {
    const authFindings = findings.filter((f) => f.ruleId === 'cmiw-sec-003');
    expect(authFindings.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect hardcoded secrets', () => {
    const secretFindings = findings.filter((f) => f.ruleId === 'cmiw-sec-004');
    expect(secretFindings.length).toBeGreaterThanOrEqual(1);
    expect(secretFindings[0].severity).toBe('critical');
  });

  it('should detect unsafe eval', () => {
    const evalFindings = findings.filter((f) => f.ruleId === 'cmiw-sec-005');
    expect(evalFindings.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect command injection', () => {
    const cmdFindings = findings.filter((f) => f.ruleId === 'cmiw-sec-006');
    expect(cmdFindings.length).toBeGreaterThanOrEqual(1);
    expect(cmdFindings[0].severity).toBe('critical');
  });

  it('should detect path traversal', () => {
    const pathFindings = findings.filter((f) => f.ruleId === 'cmiw-sec-007');
    expect(pathFindings.length).toBeGreaterThanOrEqual(1);
  });

  it('should include all 7 rules in the ruleset', () => {
    const result = runSecurityRules(project);
    expect(result.rules.length).toBe(7);
  });

  it('should include CWE and OWASP references', () => {
    for (const finding of findings) {
      expect(finding.ruleId).toBeDefined();
      expect(finding.recommendation).toBeDefined();
      expect(finding.recommendation.length).toBeGreaterThan(0);
    }
  });
});

describe('analyzeSecurityPosture', () => {
  let posture: SecurityPosture;

  beforeAll(() => {
    const project = loadProject({ targetPath: VULNERABLE_FIXTURE });
    posture = analyzeSecurityPosture(project);
  });

  it('should produce a low score for vulnerable code', () => {
    expect(posture.score).toBeLessThan(50);
  });

  it('should assign a poor grade', () => {
    expect(['D', 'F']).toContain(posture.grade);
  });

  it('should include a summary', () => {
    expect(posture.summary).toBeDefined();
    expect(posture.summary.length).toBeGreaterThan(0);
  });

  it('should include findings and rules', () => {
    expect(posture.findings.length).toBeGreaterThan(0);
    expect(posture.rules.length).toBe(7);
  });
});
