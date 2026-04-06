export type EditPlanKind = 'helm-ingress' | 'pulumi-stack-config' | 'helm-probes' | 'helm-service-port-repair';

export interface FileWritePlan {
  path: string;
  content: string;
  reason: string;
}

export interface EditPlan {
  kind: EditPlanKind;
  summary: string;
  rationale: string;
  writes: FileWritePlan[];
}
