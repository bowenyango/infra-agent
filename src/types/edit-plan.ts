export type EditPlanKind = 'helm-ingress' | 'pulumi-stack-config';

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
