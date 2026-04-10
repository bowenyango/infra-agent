import { buildHelmIngressEditPlan } from './edit-plans/helm-ingress.ts';
import { buildHelmIngressValuesRepairEditPlan } from './edit-plans/helm-ingress-values-repair.ts';
import { buildHelmProbesEditPlan } from './edit-plans/helm-probes.ts';
import { buildHelmServicePortRepairEditPlan } from './edit-plans/helm-service-port-repair.ts';
import { buildPulumiStackConfigEditPlan } from './edit-plans/pulumi-stack-config.ts';
import { buildTerraformTfvarsConfigEditPlan } from './edit-plans/terraform-tfvars-config.ts';
import { prioritizeEditPlanKinds } from './edit-plan-priority.ts';
import { classifyWritePlan } from './classify-write-plan.ts';
import { isEditPlanAllowedByPolicy } from '../domain/edit-policy.ts';
import { isWriteAllowedByWorkspacePolicy } from '../domain/workspace-policy.ts';
import type { AgentRuntimeState } from '../types/agent.ts';
import type { EditPlan } from '../types/edit-plan.ts';

export function buildEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  const planBuilders = {
    'helm-service-port-repair': buildHelmServicePortRepairEditPlan,
    'helm-ingress-values-repair': buildHelmIngressValuesRepairEditPlan,
    'helm-ingress': buildHelmIngressEditPlan,
    'helm-probes': buildHelmProbesEditPlan,
    'pulumi-stack-config': buildPulumiStackConfigEditPlan,
    'terraform-tfvars-config': buildTerraformTfvarsConfigEditPlan
  } as const;

  const candidateKinds = prioritizeEditPlanKinds(runtime.preflight.requestedDomains);
  const candidates: Array<EditPlan | null> = candidateKinds.map(kind => planBuilders[kind](runtime));

  const candidate = candidates.find((plan): plan is EditPlan => plan !== null && isEditPlanAllowedByPolicy(plan, runtime)) ?? null;
  if (!candidate) {
    return null;
  }

  const normalizedCandidateWrites = candidate.writes.map(write => classifyWritePlan(runtime, write));
  const filteredWrites = normalizedCandidateWrites.filter(write =>
    isWriteAllowedByWorkspacePolicy(write, runtime.preflight.inspection.config)
  );
  if (filteredWrites.length === 0) {
    return null;
  }

  if (filteredWrites.length === candidate.writes.length) {
    return {
      ...candidate,
      writes: filteredWrites
    };
  }

  return {
    ...candidate,
    rationale: `${candidate.rationale} Workspace write policy filtered one or more planned file changes by path or write mode.`,
    writes: filteredWrites
  };
}
