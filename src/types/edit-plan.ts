export type EditPlanKind =
  | 'helm-ingress'
  | 'pulumi-stack-config'
  | 'helm-probes'
  | 'helm-service-port-repair'
  | 'helm-ingress-values-repair';
export type FileWriteMode = 'create' | 'append' | 'rewrite';

export interface FileWritePlan {
  path: string;
  content: string;
  reason: string;
  mode?: FileWriteMode;
  patchHint?: string;
}

export interface EditPlan {
  kind: EditPlanKind;
  summary: string;
  rationale: string;
  writes: FileWritePlan[];
}
