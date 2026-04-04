import type { EstimatedChanges } from "./estimated-changes.js";
import type { RiskFinding } from "./findings.js";
import type { Cluster } from "../config/index.js";

export type DecisionMeta = {
  analysisVersion: string;
  cluster: Cluster;
  simulatedAt: string;
  confidence: "high" | "medium" | "low";
  integratorRequestId?: string;
};

export type Decision = {
  safe: boolean;
  reasons: string[];
  estimatedChanges: EstimatedChanges;
  riskFindings: RiskFinding[];
  simulationWarnings: string[];
  meta: DecisionMeta;
};
