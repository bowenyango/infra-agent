import { buildHelmIngressEditPlan } from './edit-plans/helm-ingress.ts';
import type { AgentRuntimeState } from '../types/agent.ts';
import type { EditPlan } from '../types/edit-plan.ts';

export function buildEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  const candidates: Array<EditPlan | null> = [
    buildHelmIngressEditPlan(runtime)
  ];

  return candidates.find((plan): plan is EditPlan => plan !== null) ?? null;
}

