const HIGH_SEVERITY_SCORE = 7;

export interface OsvAuditFinding {
  ids: string[];
  packageName: string;
  score: number | null;
  version: string;
}

export interface OsvAuditEvaluation {
  blocking: OsvAuditFinding[];
  findings: OsvAuditFinding[];
}

interface CycloneDxComponent {
  "bom-ref": string;
  name: string;
  purl: string;
  type: "library";
  version: string;
}

export interface ProductionDependencySbom {
  bomFormat: "CycloneDX";
  components: CycloneDxComponent[];
  metadata: {
    component: { name: "levi"; type: "application" };
    tools: {
      components: Array<{ name: "levi-security-audit"; type: "application" }>;
    };
  };
  specVersion: "1.6";
  version: 1;
}

function object(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, message: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(message);
  return value;
}

function text(value: unknown, message: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(message);
  return value;
}

function npmPurl(name: string, version: string): string {
  const encodedName = name.split("/").map(encodeURIComponent).join("/");
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

export function createProductionDependencySbom(
  licenseInventory: unknown,
): ProductionDependencySbom {
  const inventory = object(
    licenseInventory,
    "PRODUCTION_DEPENDENCY_INVENTORY_INVALID",
  );
  const components = new Map<string, CycloneDxComponent>();

  for (const packages of Object.values(inventory)) {
    for (const rawPackage of array(
      packages,
      "PRODUCTION_DEPENDENCY_LICENSE_GROUP_INVALID",
    )) {
      const packageRecord = object(
        rawPackage,
        "PRODUCTION_DEPENDENCY_RECORD_INVALID",
      );
      const name = text(
        packageRecord.name,
        "PRODUCTION_DEPENDENCY_NAME_INVALID",
      );
      for (const rawVersion of array(
        packageRecord.versions,
        "PRODUCTION_DEPENDENCY_VERSIONS_INVALID",
      )) {
        const version = text(
          rawVersion,
          "PRODUCTION_DEPENDENCY_VERSION_INVALID",
        );
        const purl = npmPurl(name, version);
        components.set(purl, {
          "bom-ref": purl,
          name,
          purl,
          type: "library",
          version,
        });
      }
    }
  }

  if (components.size === 0) {
    throw new Error("PRODUCTION_DEPENDENCY_INVENTORY_EMPTY");
  }

  return {
    bomFormat: "CycloneDX",
    components: [...components.values()].sort((left, right) =>
      left.purl.localeCompare(right.purl),
    ),
    metadata: {
      component: { name: "levi", type: "application" },
      tools: {
        components: [{ name: "levi-security-audit", type: "application" }],
      },
    },
    specVersion: "1.6",
    version: 1,
  };
}

export function evaluateOsvAuditReport(report: unknown): OsvAuditEvaluation {
  const root = object(report, "OSV_REPORT_INVALID");
  const results = array(root.results, "OSV_REPORT_RESULTS_INVALID");
  const findings: OsvAuditFinding[] = [];

  for (const rawResult of results) {
    const result = object(rawResult, "OSV_REPORT_RESULT_INVALID");
    for (const rawPackage of array(
      result.packages,
      "OSV_REPORT_PACKAGES_INVALID",
    )) {
      const packageResult = object(rawPackage, "OSV_REPORT_PACKAGE_INVALID");
      const packageIdentity = object(
        packageResult.package,
        "OSV_REPORT_PACKAGE_IDENTITY_INVALID",
      );
      const packageName = text(
        packageIdentity.name,
        "OSV_REPORT_PACKAGE_NAME_INVALID",
      );
      const version = text(
        packageIdentity.version,
        "OSV_REPORT_PACKAGE_VERSION_INVALID",
      );
      const vulnerabilities = array(
        packageResult.vulnerabilities,
        "OSV_REPORT_VULNERABILITIES_INVALID",
      );
      const groups = array(packageResult.groups, "OSV_REPORT_GROUPS_INVALID");

      if (vulnerabilities.length > 0 && groups.length === 0) {
        throw new Error("OSV_REPORT_SEVERITY_MISSING");
      }

      for (const rawGroup of groups) {
        const group = object(rawGroup, "OSV_REPORT_GROUP_INVALID");
        const ids = array(group.ids, "OSV_REPORT_GROUP_IDS_INVALID").map((id) =>
          text(id, "OSV_REPORT_GROUP_ID_INVALID"),
        );
        if (ids.length === 0) throw new Error("OSV_REPORT_GROUP_IDS_EMPTY");

        const rawScore = group.max_severity;
        const score =
          typeof rawScore === "string" && rawScore.trim() !== ""
            ? Number(rawScore)
            : Number.NaN;

        const validScore = Number.isFinite(score) && score >= 0 && score <= 10;
        findings.push({
          ids,
          packageName,
          score: validScore ? score : null,
          version,
        });
      }
    }
  }

  return {
    findings,
    blocking: findings.filter(
      (finding) =>
        finding.score === null || finding.score >= HIGH_SEVERITY_SCORE,
    ),
  };
}
