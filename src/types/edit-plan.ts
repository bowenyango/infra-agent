export type EditPlanKind =
  | 'helm-ingress'
  | 'pulumi-stack-config'
  | 'terraform-tfvars-config'
  | 'helm-probes'
  | 'helm-service-port-repair'
  | 'helm-ingress-values-repair';
export type FileWriteMode = 'create' | 'append' | 'replace' | 'rewrite';
export type FileWriteRisk = 'low' | 'medium' | 'high';

export interface ReplacePatch {
  before: string;
  after: string;
}

export interface FileWritePlan {
  path: string;
  content: string;
  reason: string;
  mode?: FileWriteMode;
  risk?: FileWriteRisk;
  patchHint?: string;
  replacePatch?: ReplacePatch;
}

export interface EditPlan {
  kind: EditPlanKind;
  summary: string;
  rationale: string;
  writes: FileWritePlan[];
}
