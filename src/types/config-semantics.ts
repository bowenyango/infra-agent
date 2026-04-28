export type ConfigSemanticsTargetKind = 'helm-chart' | 'pulumi-project' | 'terraform-root';

export type ConfigSemanticSourceKind =
  | 'helm-values-schema'
  | 'terraform-variable'
  | 'pulumi-config'
  | 'pulumi-preview'
  | 'repo-example'
  | 'llm-inference';

export type ConfigSemanticFactKind =
  | 'required-field'
  | 'configured-field'
  | 'defaulted-field'
  | 'type-constraint'
  | 'enum'
  | 'validation-rule'
  | 'mutually-exclusive-group'
  | 'exactly-one-group'
  | 'at-least-one-group'
  | 'implied-field'
  | 'disabled-field'
  | 'identity-field'
  | 'replacement-risk'
  | 'dependency-edge';

export type ConfigSemanticConfidence = 'low' | 'medium' | 'high';

export interface ConfigSemanticSource {
  kind: ConfigSemanticSourceKind;
  path: string;
  version?: string;
}

export interface ConfigSemanticFact {
  kind: ConfigSemanticFactKind;
  path: string;
  message: string;
  source: ConfigSemanticSource;
  confidence: ConfigSemanticConfidence;
  values?: string[];
  relatedPaths?: string[];
}

export interface ConfigSemanticsSummary {
  targetKind: ConfigSemanticsTargetKind;
  targetPath: string;
  facts: ConfigSemanticFact[];
}
