import type { PublicKey } from "@solana/web3.js";
import type { AppConfig } from "../config/index.js";
import type { EstimatedChanges } from "../domain/estimated-changes.js";
import type { RiskFinding } from "../domain/findings.js";
import type { NormalizedSimulation } from "../domain/simulation-normalized.js";
import type { Policy } from "../domain/policy.js";
import { detectDelegateAndApprovalFindings, detectIncompleteDataFinding } from "./detectors/deltas.js";
import { detectProgramFindings } from "./detectors/programs.js";
import { detectSimulationFindings } from "./detectors/simulation.js";

export type RiskDetectionInput = {
  config: AppConfig;
  policy: Policy;
  simulation: NormalizedSimulation;
  programIds: PublicKey[];
  estimatedChanges: EstimatedChanges;
  truncatedAccounts: boolean;
  userWallet: PublicKey | null;
};

export function runRiskDetection(input: RiskDetectionInput): RiskFinding[] {
  const {
    config,
    policy,
    simulation,
    programIds,
    estimatedChanges,
    truncatedAccounts,
    userWallet,
  } = input;

  const findings: RiskFinding[] = [];
  findings.push(...detectSimulationFindings(simulation));
  findings.push(...detectProgramFindings(programIds, config));

  const needsWalletForPolicy =
    policy.minPostUsdcBalance != null ||
    policy.maxLossPercent != null;

  const userWalletMissingForBalanceRules =
    needsWalletForPolicy && userWallet == null;

  const incomplete = detectIncompleteDataFinding({
    truncatedAccounts,
    userWalletMissingForBalanceRules,
  });
  if (incomplete) findings.push(incomplete);

  findings.push(...detectDelegateAndApprovalFindings(estimatedChanges));

  return findings;
}
