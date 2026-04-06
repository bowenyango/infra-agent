import { buildHelmIngressEditPlan } from './edit-plans/helm-ingress.ts';
import { buildHelmIngressValuesRepairEditPlan } from './edit-plans/helm-ingress-values-repair.ts';
import { buildHelmProbesEditPlan } from './edit-plans/helm-probes.ts';
import { buildHelmServicePortRepairEditPlan } from './edit-plans/helm-service-port-repair.ts';
import { buildPulumiStackConfigEditPlan } from './edit-plans/pulumi-stack-config.ts';
import { isPathAllowedByWorkspacePolicy } from '../domain/workspace-policy.ts';
import type { AgentRuntimeState } from '../types/agent.ts';
import type { EditPlan } from '../types/edit-plan.ts';

export function buildEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  const candidates: Array<EditPlan | null> = [
    buildHelmServicePortRepairEditPlan(runtime),
    buildHelmIngressValuesRepairEditPlan(runtime),
    buildHelmIngressEditPlan(runtime),
    buildHelmProbesEditPlan(runtime),
    buildPulumiStackConfigEditPlan(runtime)
  ];

  const candidate = candidates.find((plan): plan is EditPlan => plan !== null) ?? null;
  if (!candidate) {
    return null;
  }

  const filteredWrites = candidate.writes.filter(write =>
    isPathAllowedByWorkspacePolicy(write.path, runtime.preflight.inspection.config)
  );
  if (filteredWrites.length === 0) {
    return null;
  }

  if (filteredWrites.length === candidate.writes.length) {
    return candidate;
  }

  return {
    ...candidate,
    rationale: `${candidate.rationale} Workspace write policy filtered one or more planned file changes.`,
    writes: filteredWrites
  };
}
