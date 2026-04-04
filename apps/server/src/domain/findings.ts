export type RiskSeverity = "low" | "medium" | "high";

export type RiskFindingCode =
  | "SIMULATION_FAILED"
  | "SIMULATION_ERROR"
  | "LOW_CONFIDENCE_INCOMPLETE_DATA"
  | "RISKY_PROGRAM_INTERACTION"
  | "UNKNOWN_PROGRAM_EXPOSURE"
  | "APPROVAL_CHANGE_DETECTED"
  | "DELEGATE_CHANGE_DETECTED"
  | "POST_BALANCE_TOO_LOW"
  | "ESTIMATED_LOSS_EXCEEDS_MAX"
  | "LOSS_PERCENT_UNAVAILABLE";

export type RiskFinding = {
  code: RiskFindingCode;
  severity: RiskSeverity;
  message: string;
  details?: Record<string, unknown>;
};
