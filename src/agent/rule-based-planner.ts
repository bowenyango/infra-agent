import { BasePlanningModel } from './planning-model.ts';
import type { AgentDecision, AgentPlanningInput, ValidationIssue } from '../types/agent.ts';
import { selectValidationCommands } from './select-validation-commands.ts';
import type { AgentActionFamily, AgentClarificationKind, AgentStopReason } from '../types/agent.ts';
import type { EditPlanKind } from '../types/edit-plan.ts';
import { DEFAULT_QUERY_LOOP_CONFIG } from '../query-config.ts';
import type { KnowledgePackUnit } from '../knowledge/pack.ts';
import { knowledgeUnitIncludesText } from './knowledge-unit-text.ts';

function toTopTargetPaths(input: AgentPlanningInput): string[] {
  return input.runtime.preflight.targetCandidates
    .slice(0, 3)
    .map(candidate => candidate.path);
}

function getMaxRepairAttempts(input: AgentPlanningInput): number {
  return input.runtime.maxRepairAttempts ?? DEFAULT_QUERY_LOOP_CONFIG.maxRepairAttempts;
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

function buildHelmCandidateSummary(input: AgentPlanningInput): string[] {
  return input.runtime.preflight.targetCandidates
    .filter(candidate => candidate.kind === 'helm-chart')
    .slice(0, 3)
    .map(candidate => candidate.path);
}

function buildHelmClarificationQuestions(input: AgentPlanningInput, variant: 'missing-workspace' | 'ambiguous-target'): string[] {
  const candidateSummary = buildHelmCandidateSummary(input);
  const candidateQuestion = candidateSummary.length > 0
    ? `Which Helm chart should be updated? Options: ${candidateSummary.join('; ')}`
    : 'Which Helm chart or chart directory should be updated?';

  if (variant === 'missing-workspace') {
    return [
      candidateQuestion,
      'Should the agent modify an existing chart, or create a bounded chart scaffold in a specific directory?'
    ];
  }

  return [
    candidateQuestion,
    'Which environment values or chart variant should be updated?'
  ];
}

function buildPulumiCandidateSummary(input: AgentPlanningInput): string[] {
  return input.runtime.preflight.targetCandidates
    .filter(candidate => candidate.kind === 'pulumi-project')
    .slice(0, 3)
    .map(candidate => candidate.path);
}

function buildPulumiClarificationQuestions(input: AgentPlanningInput, variant: 'missing-workspace' | 'ambiguous-target'): string[] {
  const candidateSummary = buildPulumiCandidateSummary(input);
  const candidateQuestion = candidateSummary.length > 0
    ? `Which Pulumi project should be updated? Options: ${candidateSummary.join('; ')}`
    : 'Which Pulumi project or stack directory should be updated?';

  if (variant === 'missing-workspace') {
    return [
      candidateQuestion,
      'Should the agent modify an existing stack file, or create a bounded stack config file in a specific project?'
    ];
  }

  return [
    candidateQuestion,
    'Which stack or environment should be updated?'
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

function getPrimaryRequestedDomain(input: AgentPlanningInput): string | null {
  return input.runtime.preflight.requestedDomains[0] ?? null;
}

function hasTerraformRenameKnowledge(input: AgentPlanningInput): boolean {
  const unitPattern = /\b(terraform|hcl)\b.*\b(rename|moved block|moved blocks|resource address|state mv|import\/state)\b|\b(rename|moved block|moved blocks|resource address|state mv|import\/state)\b.*\b(terraform|hcl)\b/i;
  return (input.runtime.knowledgeFacts?.units ?? []).some(unit =>
    (unit.unitType === 'guidance' || unit.unitType === 'diagnostic' || unit.unitType === 'recipe')
    && knowledgeUnitIncludesText(unit, unitPattern)
  );
}

function hasPulumiRenameKnowledge(input: AgentPlanningInput): boolean {
  const unitPattern = /\b(pulumi|urn|alias|aliases|stack config|stack configuration)\b.*\b(rename|replacement|resource name|import\/state|state repair|logical name|adopt existing|retain existing|retaining physical resource|physical resource)\b|\b(rename|replacement|resource name|import\/state|state repair|logical name|adopt existing|retain existing|retaining physical resource|physical resource)\b.*\b(pulumi|urn|alias|aliases|stack config|stack configuration)\b/i;
  return (input.runtime.knowledgeFacts?.units ?? []).some(unit =>
    (unit.unitType === 'guidance' || unit.unitType === 'diagnostic' || unit.unitType === 'recipe')
    && knowledgeUnitIncludesText(unit, unitPattern)
  );
}

function findPulumiValidationReviewDiagnostic(input: AgentPlanningInput): Extract<KnowledgePackUnit, { unitType: 'diagnostic' }> | null {
  const diagnosticPattern = /\b(alias|aliases|import\/state|import|state repair|cloudfront alias|cnamealreadyexists|dns cutover|dns ownership|logical pulumi rename|logical name)\b/i;
  return (input.runtime.knowledgeFacts?.units ?? []).find((unit): unit is Extract<KnowledgePackUnit, { unitType: 'diagnostic' }> =>
    unit.unitType === 'diagnostic'
    && unit.engine === 'pulumi'
    && knowledgeUnitIncludesText(unit, diagnosticPattern)
  ) ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function helmIssueMetadataIdentity(issue: ValidationIssue): string | null {
  return issue.metadata?.missingConfigKey
    ?? issue.metadata?.yamlPath
    ?? null;
}

function helmIssueRequiredValue(issue: ValidationIssue): string | null {
  if (issue.kind === 'helm-missing-service-port') {
    return 'service.port';
  }

  if (issue.kind === 'helm-missing-ingress-values') {
    return 'ingress.enabled';
  }

  return helmIssueMetadataIdentity(issue);
}

function isCurrentHelmValidationIssue(input: AgentPlanningInput, issue: ValidationIssue): boolean {
  if (!issue.kind.startsWith('helm-') && !/^helm\b/i.test(issue.sourceCommand)) {
    return false;
  }

  const failedCommands = new Set(input.runtime.validationResults
    .filter(result => result.exitCode !== 0)
    .map(result => result.command));

  return failedCommands.size === 0 || failedCommands.has(issue.sourceCommand);
}

function helmDiagnosticMatchesIssue(
  unit: Extract<KnowledgePackUnit, { unitType: 'diagnostic' }>,
  issue: ValidationIssue
): boolean {
  const identity = helmIssueMetadataIdentity(issue);
  if (identity && knowledgeUnitIncludesText(unit, new RegExp(`\\b${escapeRegExp(issue.kind)}:${escapeRegExp(identity)}\\b`, 'i'))) {
    return true;
  }

  if (knowledgeUnitIncludesText(unit, new RegExp(`\\b${escapeRegExp(issue.kind)}\\b`, 'i'))) {
    return true;
  }

  const requiredValue = helmIssueRequiredValue(issue);
  return requiredValue !== null
    && knowledgeUnitIncludesText(unit, new RegExp(`\\b${escapeRegExp(requiredValue)}\\b`, 'i'));
}

function findHelmValidationReviewDiagnostic(input: AgentPlanningInput): Extract<KnowledgePackUnit, { unitType: 'diagnostic' }> | null {
  const issues = input.runtime.validationIssues.filter(issue => isCurrentHelmValidationIssue(input, issue));
  if (issues.length === 0) {
    return null;
  }

  return (input.runtime.knowledgeFacts?.units ?? []).find((unit): unit is Extract<KnowledgePackUnit, { unitType: 'diagnostic' }> =>
    unit.unitType === 'diagnostic'
    && unit.engine === 'helm'
    && issues.some(issue => helmDiagnosticMatchesIssue(unit, issue))
  ) ?? null;
}

function summarizePulumiDiagnosticReview(unit: Extract<KnowledgePackUnit, { unitType: 'diagnostic' }>): string {
  const review = unit.recommendedReview.slice(0, 3).join(' ');
  return review.length > 0 ? review : unit.likelyCause;
}

function summarizeHelmDiagnosticReview(unit: Extract<KnowledgePackUnit, { unitType: 'diagnostic' }>): string {
  const review = unit.recommendedReview.slice(0, 3).join(' ');
  return review.length > 0 ? review : unit.likelyCause;
}

function hasCurrentPulumiValidationFailure(input: AgentPlanningInput): boolean {
  const failedCommands = new Set(input.runtime.validationResults
    .filter(result => result.exitCode !== 0)
    .map(result => result.command));

  return input.runtime.validationResults.some(result =>
    result.exitCode !== 0
    && /\bpulumi\b.*\b(preview|up|update)\b/i.test(result.command)
  )
  || input.runtime.validationIssues.some(issue =>
    issue.kind.startsWith('pulumi-')
    && failedCommands.has(issue.sourceCommand)
  );
}

function taskRequestsTerraformRenameReview(task: string): boolean {
  return /\b(rename|renaming|moved block|moved blocks|state mv|move resource|resource address|refactor|adopt|import existing|retain existing)\b/i.test(task);
}

function taskRequestsPulumiRenameReview(task: string): boolean {
  return /\b(rename|renaming|alias|aliases|urn|move resource|resource name|logical name|state repair|refactor|adopt|adopt existing|import existing|import\/state|retain existing|retaining physical resource|replacement)\b/i.test(task);
}

function isYamlSyntaxValidationCommand(command: string): boolean {
  return command.startsWith('infra-agent yaml-parse ');
}

function actionFamilyForClarification(input: AgentPlanningInput, clarificationKind: AgentClarificationKind): AgentActionFamily {
  if (clarificationKind === 'approval-required') {
    return 'approval-clarification';
  }

  const primaryDomain = getPrimaryRequestedDomain(input);
  if (primaryDomain === 'terraform') {
    return 'terraform-clarification';
  }

  if (primaryDomain === 'pulumi') {
    return 'pulumi-clarification';
  }

  if (primaryDomain === 'helm') {
    return 'helm-clarification';
  }

  return 'runtime-clarification';
}

function actionFamilyForInspection(input: AgentPlanningInput): AgentActionFamily {
  const primaryDomain = getPrimaryRequestedDomain(input);
  if (primaryDomain === 'terraform') {
    return 'terraform-inspection';
  }

  if (primaryDomain === 'pulumi') {
    return 'pulumi-inspection';
  }

  if (primaryDomain === 'helm') {
    return 'helm-inspection';
  }

  return 'runtime-inspection';
}

function actionFamilyForValidation(input: AgentPlanningInput): AgentActionFamily {
  const primaryDomain = getPrimaryRequestedDomain(input);
  if (primaryDomain === 'terraform') {
    return 'terraform-validation';
  }

  if (primaryDomain === 'pulumi') {
    return 'pulumi-validation';
  }

  if (primaryDomain === 'helm') {
    return 'helm-validation';
  }

  return 'runtime-stop';
}

function terraformRenameKnowledgeQuestions(input: AgentPlanningInput): string[] {
  const target = input.runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');
  const targetText = target ? ` in ${target.path}` : '';

  return [
    `Is this a Terraform logical resource-address rename${targetText} where the existing remote object should be retained?`,
    'What are the exact old and new Terraform resource addresses for the moved block?',
    'Should the agent add or review a Terraform moved block instead of creating replacement resources?'
  ];
}

function pulumiRenameKnowledgeQuestions(input: AgentPlanningInput): string[] {
  const target = input.runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'pulumi-project');
  const targetText = target ? ` in ${target.path}` : '';

  return [
    `Is this a Pulumi logical resource rename${targetText} where the existing physical resource should be retained?`,
    'What are the old and new Pulumi resource type, logical name, and stack/URN details needed to review aliases?',
    'Should stack config changes use the native pulumi_config_set path after approval, or is this only an alias/import review?'
  ];
}

function actionFamilyForEditPlan(kind: EditPlanKind): AgentActionFamily {
  if (kind.startsWith('terraform-')) {
    return 'terraform-bounded-edit';
  }

  if (kind.startsWith('pulumi-')) {
    return 'pulumi-bounded-edit';
  }

  return 'helm-bounded-edit';
}

function actionFamilyForStopReason(stopReason: AgentStopReason): AgentActionFamily {
  switch (stopReason) {
    case 'validation-succeeded':
      return 'validation-complete';
    case 'validation-blocked':
      return 'validation-blocked';
    case 'repair-budget-exhausted':
      return 'repair-budget-exhausted';
    case 'no-safe-action':
    default:
      return 'runtime-stop';
  }
}

export class RuleBasedPlanningModel extends BasePlanningModel {
  readonly name = 'rule-based-planner';

  async decideNextAction(input: AgentPlanningInput): Promise<AgentDecision> {
    const { runtime } = input;
    const { preflight } = runtime;
    const taskMentionsTerraform = /\b(terraform|tfvars|module|variable|variables)\b/i.test(runtime.task);
    const taskMentionsHelm =
      /\b(helm|chart|values|ingress|probe|probes|readiness|liveness|health|healthcheck)\b/i.test(runtime.task)
      || (preflight.requestedDomains.length === 1 && preflight.requestedDomains[0] === 'helm');
    const taskHasPulumiRenameVocabulary = taskRequestsPulumiRenameReview(runtime.task);
    const hasPulumiTarget = preflight.targetCandidates.some(candidate => candidate.kind === 'pulumi-project');
    const taskMentionsPulumi =
      /\b(pulumi|stack|stacks|preview|config)\b/i.test(runtime.task)
      || (preflight.requestedDomains.length === 1 && preflight.requestedDomains[0] === 'pulumi')
      || (hasPulumiTarget && taskHasPulumiRenameVocabulary);
    const topScore = preflight.targetCandidates[0]?.score ?? 0;
    const hasValidatorsAvailable = preflight.validation.validators.every(validator => validator.available);
    const hasObservations = runtime.observations.length > 0;
    const hasAppliedWrites = runtime.appliedWrites.length > 0;
    const hasTargetValidationResults = runtime.validationResults.some(result => !isYamlSyntaxValidationCommand(result.command));
    const hasValidationFailures = runtime.validationResults.some(result => result.exitCode !== 0);
    const hasRepairableValidationIssues = runtime.validationIssues.some(issue => issue.repairable);
    const hasApprovalSignals = runtime.approvalSignals.length > 0;
    const editPlan = runtime.lastEditPlan;
    const hasWritePolicyBlocker = preflight.blockers.some(blocker => blocker.startsWith('Workspace write policy'));
    const terraformFormattingIssue = runtime.validationIssues.find(issue => issue.kind === 'terraform-formatting-required');
    const topTerraformTarget = preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');
    const hasHelmTarget = preflight.targetCandidates.some(candidate => candidate.kind === 'helm-chart');
    const hasTerraformTarget = preflight.targetCandidates.some(candidate => candidate.kind === 'terraform-root');
    const isMissingRequestedDomainTarget =
      (taskMentionsHelm && !hasHelmTarget)
      || (taskMentionsPulumi && !hasPulumiTarget)
      || (taskMentionsTerraform && !hasTerraformTarget);

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
            clarificationKind: 'workspace-policy',
            actionFamily: actionFamilyForClarification(input, 'workspace-policy')
          }
        }
      };
    }

    if ((preflight.blockers.length > 0 && preflight.targetCandidates.length === 0) || isMissingRequestedDomainTarget) {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: taskMentionsTerraform
            ? 'Clarify the Terraform workspace and target before any modification step.'
            : taskMentionsPulumi
              ? 'Clarify the Pulumi workspace and target before any modification step.'
              : taskMentionsHelm
                ? 'Clarify the Helm workspace and target before any modification step.'
                : 'Clarify workspace and target before any modification step.',
          rationale: taskMentionsTerraform
            ? 'The workspace does not currently expose any detectable Terraform root for the requested task.'
            : taskMentionsPulumi
              ? 'The workspace does not currently expose any detectable Pulumi project for the requested task.'
              : taskMentionsHelm
                ? 'The workspace does not currently expose any detectable Helm chart for the requested task.'
                : 'The workspace does not currently expose any detectable Helm, Pulumi, or Terraform targets.',
          payload: {
            questions: taskMentionsTerraform
              ? buildTerraformClarificationQuestions(input, 'missing-workspace')
              : taskMentionsPulumi
                ? buildPulumiClarificationQuestions(input, 'missing-workspace')
                : taskMentionsHelm
                  ? buildHelmClarificationQuestions(input, 'missing-workspace')
                : [
                  'Which repository or subdirectory contains the target Helm chart, Pulumi project, or Terraform root?',
                  'Should the agent modify an existing infrastructure target, or is a new target expected?'
                ],
            clarificationKind: 'target-ambiguity',
            actionFamily: actionFamilyForClarification(input, 'target-ambiguity')
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
            : preflight.requestedDomains.length > 1
              ? 'Clarify the primary infrastructure domain before editing files.'
            : taskMentionsPulumi
              ? 'Clarify the intended Pulumi project, stack, or environment before editing files.'
              : taskMentionsHelm
                ? 'Clarify the intended Helm chart, values scope, or environment before editing files.'
            : 'Clarify the intended service, chart, or environment before editing files.',
          rationale: requestedDomainSummary
            ? requestedDomainSummary
            : taskMentionsTerraform
              ? 'The task references Terraform, but the requested root, variable scope, or environment is still ambiguous.'
              : taskMentionsPulumi
                ? 'The task references Pulumi, but the requested project, stack, or environment is still ambiguous.'
                : taskMentionsHelm
                  ? 'The task references Helm, but the requested chart, values scope, or environment is still ambiguous.'
            : 'The task does not map strongly enough onto a detected workspace target.',
          payload: {
            questions: preflight.requestedDomains.length > 1
              ? [
                  `Which primary domain should the agent modify first: ${preflight.requestedDomains.join(', ')}?`,
                  'Should the task be split into separate bounded changes per domain?'
                ]
              : taskMentionsTerraform
              ? buildTerraformClarificationQuestions(input, 'ambiguous-target')
              : taskMentionsPulumi
                ? buildPulumiClarificationQuestions(input, 'ambiguous-target')
                : taskMentionsHelm
                  ? buildHelmClarificationQuestions(input, 'ambiguous-target')
                : [
                  'What is the exact target service or chart name?',
                  'Which environment should be modified?'
                ],
            clarificationKind: 'target-ambiguity',
            actionFamily: actionFamilyForClarification(input, 'target-ambiguity')
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
            requestedDomains: preflight.requestedDomains,
            actionFamily: actionFamilyForInspection(input)
          }
        }
      };
    }

    if (
      editPlan?.kind.startsWith('pulumi-')
      && taskMentionsPulumi
      && taskRequestsPulumiRenameReview(runtime.task)
      && hasPulumiRenameKnowledge(input)
      && !hasAppliedWrites
    ) {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Review Pulumi rename, alias, or stack-config requirements before editing resources.',
          rationale: 'The selected knowledge units indicate that Pulumi logical renames need alias, import/state, or stack-config review before applying bounded stack config edits.',
          payload: {
            questions: pulumiRenameKnowledgeQuestions(input),
            clarificationKind: 'general',
            actionFamily: 'pulumi-clarification'
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
            summary: 'Approve gated operations before applying changes.',
            rationale: 'The current edit plan includes one or more writes or native operations that workspace policy requires explicit approval for before execution.',
            payload: {
              questions: runtime.approvalSignals.map(signal => `${signal.message} Proceed with this operation?`),
              clarificationKind: 'approval-required',
              actionFamily: actionFamilyForClarification(input, 'approval-required')
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
            editPlan,
            actionFamily: actionFamilyForEditPlan(editPlan.kind)
          }
        }
      };
    }

    const maxRepairAttempts = getMaxRepairAttempts(input);

    if (hasValidationFailures && terraformFormattingIssue && runtime.repairAttempts < maxRepairAttempts && topTerraformTarget) {
      return {
        confidence: 'high',
        action: {
          kind: 'repair-terraform-formatting',
          summary: `Run terraform fmt for ${topTerraformTarget.path} before retrying validation.`,
          rationale: terraformFormattingIssue.message,
          payload: {
            rootPath: topTerraformTarget.path,
            actionFamily: 'terraform-repair'
          }
        }
      };
    }

    if (hasValidationFailures && hasRepairableValidationIssues && editPlan && editPlan.writes.length > 0 && runtime.repairAttempts < maxRepairAttempts) {
      return {
        confidence: 'high',
        action: {
          kind: 'apply-edit-plan',
          summary: editPlan.summary,
          rationale: `Repair loop: ${editPlan.rationale}`,
          payload: {
            writes: editPlan.writes,
            editPlan,
            actionFamily: actionFamilyForEditPlan(editPlan.kind)
          }
        }
      };
    }

    if (hasAppliedWrites && !hasTargetValidationResults && !hasValidationFailures && preflight.validation.plan.length > 0 && hasValidatorsAvailable) {
      const commands = selectValidationCommands(runtime);
      return {
        confidence: 'medium',
        action: {
          kind: 'validate-targets',
          summary: summarizeValidationStep(input),
          rationale: summarizeValidationRationale(input),
          payload: {
            commands,
            actionFamily: actionFamilyForValidation(input)
          }
        }
      };
    }

    if (hasTargetValidationResults && !hasValidationFailures) {
      return {
        confidence: 'high',
        action: {
          kind: 'stop',
          summary: 'Validation completed successfully.',
          rationale: 'The applied bounded edits passed the configured validation commands for the selected targets.',
          payload: {
            stopReason: 'validation-succeeded',
            actionFamily: actionFamilyForStopReason('validation-succeeded')
          }
        }
      };
    }

    if (hasValidationFailures) {
      const unrepairableIssue = runtime.validationIssues.find(issue => !issue.repairable);
      const repairBudgetExhausted = hasRepairableValidationIssues && runtime.repairAttempts >= maxRepairAttempts;
      const pulumiReviewDiagnostic = findPulumiValidationReviewDiagnostic(input);
      if (!repairBudgetExhausted && pulumiReviewDiagnostic && hasCurrentPulumiValidationFailure(input)) {
        return {
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Pulumi validation failed and requires alias, import, or state review.',
            rationale: `A selected Pulumi diagnostic unit matched the validation failure: ${summarizePulumiDiagnosticReview(pulumiReviewDiagnostic)}`,
            payload: {
              stopReason: 'validation-blocked',
              actionFamily: 'pulumi-validation'
            }
          }
        };
      }

      const helmReviewDiagnostic = findHelmValidationReviewDiagnostic(input);
      if (!repairBudgetExhausted && helmReviewDiagnostic) {
        return {
          confidence: 'medium',
          action: {
            kind: 'stop',
            summary: 'Helm validation failed and requires chart values review.',
            rationale: `A selected Helm diagnostic unit matched the validation failure: ${summarizeHelmDiagnosticReview(helmReviewDiagnostic)}`,
            payload: {
              stopReason: 'validation-blocked',
              actionFamily: 'helm-validation'
            }
          }
        };
      }

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
            stopReason: repairBudgetExhausted ? 'repair-budget-exhausted' : 'validation-blocked',
            actionFamily: actionFamilyForStopReason(repairBudgetExhausted ? 'repair-budget-exhausted' : 'validation-blocked')
          }
        }
      };
    }

    if (
      taskMentionsTerraform
      && taskRequestsTerraformRenameReview(runtime.task)
      && hasTerraformRenameKnowledge(input)
      && hasObservations
      && !hasAppliedWrites
      && !editPlan
    ) {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Review Terraform logical rename requirements before editing resources.',
          rationale: 'The selected knowledge units indicate that Terraform resource-address renames should use moved blocks or explicit state/import review instead of speculative replacement edits.',
          payload: {
            questions: terraformRenameKnowledgeQuestions(input),
            clarificationKind: 'general',
            actionFamily: 'terraform-clarification'
          }
        }
      };
    }

    if (
      taskMentionsPulumi
      && taskRequestsPulumiRenameReview(runtime.task)
      && hasPulumiRenameKnowledge(input)
      && hasObservations
      && !hasAppliedWrites
      && !editPlan
    ) {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Review Pulumi rename, alias, or stack-config requirements before editing resources.',
          rationale: 'The selected knowledge units indicate that Pulumi logical renames should use aliases, import/state review, or bounded stack config operations instead of speculative replacement edits.',
          payload: {
            questions: pulumiRenameKnowledgeQuestions(input),
            clarificationKind: 'general',
            actionFamily: 'pulumi-clarification'
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
          stopReason: 'no-safe-action',
          actionFamily: actionFamilyForStopReason('no-safe-action')
        }
      }
    };
  }
}
