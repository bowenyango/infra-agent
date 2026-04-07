export type EditPlanKind =
  | 'helm-ingress'
  | 'pulumi-stack-config'
  | 'helm-probes'
  | 'helm-service-port-repair'
  | 'helm-ingress-values-repair';
export type FileWriteMode = 'create' | 'append' | 'replace' | 'rewrite';

export interface ReplacePatch {
  before: string;
  after: string;
}

export interface FileWritePlan {
  path: string;
  content: string;
  reason: string;
  mode?: FileWriteMode;
  patchHint?: string;
  replacePatch?: ReplacePatch;
}

export interface EditPlan {
  kind: EditPlanKind;
  summary: string;
  rationale: string;
  writes: FileWritePlan[];
}
