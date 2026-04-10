import { BasePlanningModel } from './planning-model.ts';
import type { AgentDecision, AgentPlanningInput } from '../types/agent.ts';
import { selectValidationCommands } from './select-validation-commands.ts';

function toTopTargetPaths(input: AgentPlanningInput): string[] {
  return input.runtime.preflight.targetCandidates
    .slice(0, 3)
    .map(candidate => candidate.path);
}

function buildTerraformCandidateSummary(input: AgentPlanningInput): string[] {
  return input.runtime.preflight.targetCandidates
    .filter(candidate => candidate.kind === 'terraform-root')
    .slice(0, 3)
    .map(candidate => {
      const tfvarsDetail = candidate.details?.find(detail => detail.startsWith('tfvars: '));
      return tfvarsDetail
        ? `${candidate.path} (${tfvarsDetail})`
        : candidate.path;
    });
}

function buildTerraformClarificationQuestions(input: AgentPlanningInput, variant: 'missing-workspace' | 'ambiguous-target'): string[] {
  const candidateSummary = buildTerraformCandidateSummary(input);
  const candidateQuestion = candidateSummary.length > 0
    ? `Which Terraform root should be updated? Options: ${candidateSummary.join('; ')}`
    : 'Which Terraform root or subdirectory should be updated?';

  if (variant === 'missing-workspace') {
    return [
      candidateQuestion,
      'Should the agent modify an existing tfvars file, or create a bounded terraform.auto.tfvars file in that root?'
    ];
  }

  return [
    candidateQuestion,
    'Which environment or tfvars file should be updated?'
  ];
}

function describeRequestedDomains(domains: string[]): string {
  return domains.length > 0 ? domains.join(', ') : 'infrastructure';
}

function summarizeInspectionStep(input: AgentPlanningInput): string {
  const domains = input.runtime.preflight.requestedDomains;
  if (domains.length === 1 && domains[0] === 'terraform') {
    return 'Inspect the selected Terraform root files before generating edits.';
  }

  if (domains.length === 1 && domains[0] === 'pulumi') {
    return 'Inspect the selected Pulumi project and stack files before generating edits.';
  }

  if (domains.length === 1 && domains[0] === 'helm') {
    return 'Inspect the selected Helm chart files before generating edits.';
  }

  return 'Inspect the highest-confidence infrastructure targets before generating edits.';
}

function summarizeInspectionRationale(input: AgentPlanningInput): string {
  const domains = input.runtime.preflight.requestedDomains;
  if (domains.length > 0) {
    return `The workspace has candidate targets that match the requested ${describeRequestedDomains(domains)} task.`;
  }

  return 'The workspace has candidate targets that match the requested service and environment.';
}

function summarizeValidationStep(input: AgentPlanningInput): string {
  const domains = input.runtime.preflight.requestedDomains;
  if (domains.length === 1 && domains[0] === 'terraform') {
    return 'Run Terraform validators for the selected root.';
  }

  if (domains.length === 1 && domains[0] === 'pulumi') {
    return 'Run Pulumi preview for the selected project.';
  }

  if (domains.length === 1 && domains[0] === 'helm') {
    return 'Run Helm validators for the selected chart.';
  }

  return 'Run validators for the detected infrastructure targets.';
}

function summarizeValidationRationale(input: AgentPlanningInput): string {
  const domains = input.runtime.preflight.requestedDomains;
  if (domains.length > 0) {
    return `The workspace has validation commands available for the requested ${describeRequestedDomains(domains)} path.`;
  }

  return 'The workspace has detectable validation targets and validators are available.';
}

export class RuleBasedPlanningModel extends BasePlanningModel {
  readonly name = 'rule-based-planner';

  async decideNextAction(input: AgentPlanningInput): Promise<AgentDecision> {
    const { runtime } = input;
    const { preflight } = runtime;
    const taskMentionsTerraform = /\b(terraform|tfvars|module|variable|variables)\b/i.test(runtime.task);
    const topScore = preflight.targetCandidates[0]?.score ?? 0;
    const hasValidatorsAvailable = preflight.validation.validators.every(validator => validator.available);
    const hasObservations = runtime.observations.length > 0;
    const hasAppliedWrites = runtime.appliedWrites.length > 0;
    const hasValidationResults = runtime.validationResults.length > 0;
    const hasValidationFailures = runtime.validationResults.some(result => result.exitCode !== 0);
    const hasRepairableValidationIssues = runtime.validationIssues.some(issue => issue.repairable);
    const hasApprovalSignals = runtime.approvalSignals.length > 0;
    const editPlan = runtime.lastEditPlan;
    const hasWritePolicyBlocker = preflight.blockers.some(blocker => blocker.startsWith('Workspace write policy'));
    const terraformFormattingIssue = runtime.validationIssues.find(issue => issue.kind === 'terraform-formatting-required');
    const topTerraformTarget = preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');

    if (hasWritePolicyBlocker) {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Clarify writable target boundaries before applying changes.',
          rationale: 'The workspace config currently forbids writes to the highest-confidence target for this task.',
          payload: {
            questions: [
              'Should the workspace write policy be expanded for this task?',
              'Is there a different writable target path the agent should modify instead?'
            ],
            clarificationKind: 'workspace-policy'
          }
        }
      };
    }

    if (preflight.blockers.length > 0 && preflight.targetCandidates.length === 0) {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: taskMentionsTerraform
            ? 'Clarify the Terraform workspace and target before any modification step.'
            : 'Clarify workspace and target before any modification step.',
          rationale: taskMentionsTerraform
            ? 'The workspace does not currently expose any detectable Terraform root for the requested task.'
            : 'The workspace does not currently expose any detectable Helm, Pulumi, or Terraform targets.',
          payload: {
            questions: taskMentionsTerraform
              ? buildTerraformClarificationQuestions(input, 'missing-workspace')
              : [
                  'Which repository or subdirectory contains the target Helm chart, Pulumi project, or Terraform root?',
                  'Should the agent modify an existing infrastructure target, or is a new target expected?'
                ],
            clarificationKind: 'target-ambiguity'
          }
        }
      };
    }

    if (preflight.assumptions.length > 0 || topScore === 0) {
      const requestedDomainSummary = preflight.requestedDomains.length > 1
        ? `The task currently spans multiple infrastructure domains (${preflight.requestedDomains.join(', ')}), so the primary domain boundary is still ambiguous.`
        : null;
      return {
        confidence: 'medium',
        action: {
          kind: 'ask-for-clarification',
          summary: taskMentionsTerraform
            ? 'Clarify the intended Terraform root, variables, or environment before editing files.'
            : 'Clarify the intended service, chart, or environment before editing files.',
          rationale: requestedDomainSummary
            ? requestedDomainSummary
            : taskMentionsTerraform
            ? 'The task references Terraform, but the requested root, variable scope, or environment is still ambiguous.'
            : 'The task does not map strongly enough onto a detected workspace target.',
          payload: {
            questions: taskMentionsTerraform
              ? buildTerraformClarificationQuestions(input, 'ambiguous-target')
              : preflight.requestedDomains.length > 1
                ? [
                    `Which primary domain should the agent modify first: ${preflight.requestedDomains.join(', ')}?`,
                    'Should the task be split into separate bounded changes per domain?'
                  ]
                : [
                  'What is the exact target service or chart name?',
                  'Which environment should be modified?'
                ],
            clarificationKind: 'target-ambiguity'
          }
        }
      };
    }

    if (!hasObservations && preflight.targetCandidates.length > 0) {
      return {
        confidence: 'high',
        action: {
          kind: 'inspect-target-files',
          summary: summarizeInspectionStep(input),
          rationale: summarizeInspectionRationale(input),
          payload: {
            targetPaths: toTopTargetPaths(input),
            requestedDomains: preflight.requestedDomains
          }
        }
      };
    }

    if (!hasAppliedWrites && editPlan && editPlan.writes.length > 0) {
      if (hasApprovalSignals) {
        return {
          confidence: 'high',
          action: {
            kind: 'ask-for-clarification',
            summary: 'Approve high-risk rewrite operations before applying changes.',
            rationale: 'The current edit plan includes one or more high-risk full-file rewrites that should be explicitly approved before execution.',
            payload: {
              questions: runtime.approvalSignals.map(signal => `${signal.message} Proceed with this rewrite?`),
              clarificationKind: 'approval-required'
            }
          }
        };
      }

      return {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: editPlan.summary,
          rationale: editPlan.rationale,
          payload: {
            writes: editPlan.writes,
            editPlan
          }
        }
      };
    }

    if (hasValidationFailures && terraformFormattingIssue && runtime.repairAttempts < 2 && topTerraformTarget) {
      return {
        confidence: 'high',
        action: {
          kind: 'repair-terraform-formatting',
          summary: `Run terraform fmt for ${topTerraformTarget.path} before retrying validation.`,
          rationale: terraformFormattingIssue.message,
          payload: {
            rootPath: topTerraformTarget.path
          }
        }
      };
    }

    if (hasValidationFailures && hasRepairableValidationIssues && editPlan && editPlan.writes.length > 0 && runtime.repairAttempts < 2) {
      return {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: editPlan.summary,
          rationale: `Repair loop: ${editPlan.rationale}`,
          payload: {
            writes: editPlan.writes,
            editPlan
          }
        }
      };
    }

    if (hasAppliedWrites && !hasValidationResults && preflight.validation.plan.length > 0 && hasValidatorsAvailable) {
      const commands = selectValidationCommands(runtime);
      return {
        confidence: 'medium',
        action: {
          kind: 'validate-targets',
          summary: summarizeValidationStep(input),
          rationale: summarizeValidationRationale(input),
          payload: {
            commands
          }
        }
      };
    }

    if (hasValidationResults && !hasValidationFailures) {
      return {
        confidence: 'high',
        action: {
          kind: 'stop',
          summary: 'Validation completed successfully.',
          rationale: 'The applied bounded edits passed the configured validation commands for the selected targets.',
          payload: {
            stopReason: 'validation-succeeded'
          }
        }
      };
    }

    if (hasValidationFailures) {
      const unrepairableIssue = runtime.validationIssues.find(issue => !issue.repairable);
      const repairBudgetExhausted = hasRepairableValidationIssues && runtime.repairAttempts >= 2;
      return {
        confidence: 'medium',
        action: {
          kind: 'stop',
          summary: repairBudgetExhausted
            ? 'Validation failed after the bounded repair budget was exhausted.'
            : 'Validation failed and no bounded repair action was available.',
          rationale: repairBudgetExhausted
            ? 'The runtime found repairable validation issues, but the bounded repair loop already consumed its configured retry budget.'
            : unrepairableIssue
              ? `Validation failed with an unclassified blocker: ${unrepairableIssue.message}`
              : 'The current runtime captured validation failures, but the bounded repair planner could not derive a safe follow-up edit.',
          payload: {
            stopReason: repairBudgetExhausted ? 'repair-budget-exhausted' : 'validation-blocked'
          }
        }
      };
    }

    return {
      confidence: hasObservations ? 'medium' : 'low',
      action: {
        kind: 'stop',
        summary: 'No additional safe action was identified for the current task.',
        rationale: 'The current runtime state does not support another bounded edit or validation step.',
        payload: {
          stopReason: 'no-safe-action'
        }
      }
    };
  }
}
