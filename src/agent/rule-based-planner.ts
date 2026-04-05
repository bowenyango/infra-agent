import { BasePlanningModel } from './planning-model.ts';
import type { AgentDecision, AgentPlanningInput } from '../types/agent.ts';
import { selectValidationCommands } from './select-validation-commands.ts';

function toTopTargetPaths(input: AgentPlanningInput): string[] {
  return input.runtime.preflight.targetCandidates
    .slice(0, 3)
    .map(candidate => candidate.path);
}

export class RuleBasedPlanningModel extends BasePlanningModel {
  readonly name = 'rule-based-planner';

  async decideNextAction(input: AgentPlanningInput): Promise<AgentDecision> {
    const { runtime } = input;
    const { preflight } = runtime;
    const topScore = preflight.targetCandidates[0]?.score ?? 0;
    const hasValidatorsAvailable = preflight.validation.validators.every(validator => validator.available);
    const hasObservations = runtime.observations.length > 0;
    const hasAppliedWrites = runtime.appliedWrites.length > 0;
    const editPlan = runtime.lastEditPlan;

    if (preflight.blockers.length > 0 && preflight.targetCandidates.length === 0) {
      return {
        confidence: 'high',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Clarify workspace and target before any modification step.',
          rationale: 'The workspace does not currently expose any detectable Helm or Pulumi targets.',
          payload: {
            questions: [
              'Which repository or subdirectory contains the target Helm chart or Pulumi project?',
              'Should the agent create a new chart or stack, or modify an existing one?'
            ]
          }
        }
      };
    }

    if (preflight.assumptions.length > 0 || topScore === 0) {
      return {
        confidence: 'medium',
        action: {
          kind: 'ask-for-clarification',
          summary: 'Clarify the intended service, chart, or environment before editing files.',
          rationale: 'The task does not map strongly enough onto a detected workspace target.',
          payload: {
            questions: [
              'What is the exact target service or chart name?',
              'Which environment should be modified?'
            ]
          }
        }
      };
    }

    if (!hasObservations && preflight.targetCandidates.length > 0) {
      return {
        confidence: 'high',
        action: {
          kind: 'inspect-target-files',
          summary: 'Inspect the highest-confidence Helm and Pulumi targets before generating edits.',
          rationale: 'The workspace has candidate targets that match the requested service and environment.',
          payload: {
            targetPaths: toTopTargetPaths(input)
          }
        }
      };
    }

    if (!hasAppliedWrites && editPlan && editPlan.writes.length > 0) {
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

    if (hasAppliedWrites && preflight.validation.plan.length > 0 && hasValidatorsAvailable) {
      const commands = selectValidationCommands(runtime);
      return {
        confidence: 'medium',
        action: {
          kind: 'validate-targets',
          summary: 'Run validators for the detected infrastructure targets.',
          rationale: 'The workspace has detectable validation targets and validators are available.',
          payload: {
            commands
          }
        }
      };
    }

    return {
      confidence: hasObservations ? 'medium' : 'low',
      action: {
        kind: 'stop',
        summary: 'No additional safe action was identified for the current task.',
        rationale: 'The current runtime state does not support another bounded edit or validation step.'
      }
    };
  }
}
