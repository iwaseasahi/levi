import { describe, expect, it } from "vitest";

import {
  createProductionDependencySbom,
  evaluateOsvAuditReport,
} from "./osv-audit";

function report(maxSeverity: string) {
  return {
    results: [
      {
        packages: [
          {
            package: { ecosystem: "npm", name: "example", version: "1.0.0" },
            vulnerabilities: [{ id: "GHSA-example" }],
            groups: [
              {
                ids: ["GHSA-example", "CVE-2099-0001"],
                max_severity: maxSeverity,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("evaluateOsvAuditReport", () => {
  it("accepts an empty report and vulnerabilities below high severity", () => {
    expect(evaluateOsvAuditReport({ results: [] })).toEqual({
      blocking: [],
      findings: [],
    });

    const evaluation = evaluateOsvAuditReport(report("5.9"));
    expect(evaluation.blocking).toEqual([]);
    expect(evaluation.findings).toEqual([
      {
        ids: ["GHSA-example", "CVE-2099-0001"],
        packageName: "example",
        score: 5.9,
        version: "1.0.0",
      },
    ]);
  });

  it("blocks high and critical vulnerabilities", () => {
    expect(evaluateOsvAuditReport(report("7.0")).blocking).toHaveLength(1);
    expect(evaluateOsvAuditReport(report("9.8")).blocking).toHaveLength(1);
  });

  it("fails closed when severity or report structure is unavailable", () => {
    expect(
      evaluateOsvAuditReport(report("UNKNOWN")).blocking[0]?.score,
    ).toBeNull();
    expect(evaluateOsvAuditReport(report("11")).blocking[0]?.score).toBeNull();
    expect(() => evaluateOsvAuditReport({})).toThrow(
      "OSV_REPORT_RESULTS_INVALID",
    );
    expect(() =>
      evaluateOsvAuditReport({
        results: [
          {
            packages: [
              {
                package: { name: "example", version: "1.0.0" },
                vulnerabilities: [{ id: "GHSA-example" }],
                groups: [],
              },
            ],
          },
        ],
      }),
    ).toThrow("OSV_REPORT_SEVERITY_MISSING");
  });
});

describe("createProductionDependencySbom", () => {
  it("creates a deterministic npm SBOM from production license inventory", () => {
    const sbom = createProductionDependencySbom({
      MIT: [
        { name: "plain", versions: ["2.0.0", "1.0.0"] },
        { name: "@scope/package", versions: ["3.0.0"] },
      ],
    });

    expect(sbom.components).toEqual([
      {
        "bom-ref": "pkg:npm/%40scope/package@3.0.0",
        name: "@scope/package",
        purl: "pkg:npm/%40scope/package@3.0.0",
        type: "library",
        version: "3.0.0",
      },
      {
        "bom-ref": "pkg:npm/plain@1.0.0",
        name: "plain",
        purl: "pkg:npm/plain@1.0.0",
        type: "library",
        version: "1.0.0",
      },
      {
        "bom-ref": "pkg:npm/plain@2.0.0",
        name: "plain",
        purl: "pkg:npm/plain@2.0.0",
        type: "library",
        version: "2.0.0",
      },
    ]);
  });

  it("rejects missing or empty production dependency inventory", () => {
    expect(() => createProductionDependencySbom({})).toThrow(
      "PRODUCTION_DEPENDENCY_INVENTORY_EMPTY",
    );
    expect(() => createProductionDependencySbom({ MIT: [{}] })).toThrow(
      "PRODUCTION_DEPENDENCY_NAME_INVALID",
    );
  });
});
