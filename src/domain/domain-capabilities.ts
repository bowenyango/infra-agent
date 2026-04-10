import type {
  DomainCapabilitySummary,
  InfraDomainId,
  WorkspaceInspection
} from '../types/repository.ts';

interface DomainDefinition {
  id: InfraDomainId;
  label: string;
  supportedTaskKinds: string[];
  boundedEditKinds: string[];
  validatorCommands: string[];
}

const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    id: 'helm',
    label: 'Helm',
    supportedTaskKinds: [
      'inspect charts and values',
      'add ingress',
      'add probes',
      'repair bounded validation issues'
    ],
    boundedEditKinds: [
      'helm-ingress',
      'helm-probes',
      'helm-service-port-repair',
      'helm-ingress-values-repair'
    ],
    validatorCommands: [
      'helm lint',
      'helm template'
    ]
  },
  {
    id: 'pulumi',
    label: 'Pulumi',
    supportedTaskKinds: [
      'inspect projects and stacks',
      'update stack config values',
      'reuse existing stack namespaces'
    ],
    boundedEditKinds: [
      'pulumi-stack-config'
    ],
    validatorCommands: [
      'pulumi preview'
    ]
  },
  {
    id: 'terraform',
    label: 'Terraform',
    supportedTaskKinds: [
      'inspect roots and tfvars',
      'update bounded tfvars values',
      'repair formatting before revalidation'
    ],
    boundedEditKinds: [
      'terraform-tfvars-config'
    ],
    validatorCommands: [
      'terraform fmt -check',
      'terraform validate'
    ]
  }
];

function countDetectedTargets(domainId: InfraDomainId, inspection: Pick<WorkspaceInspection, 'helmCharts' | 'pulumiProjects' | 'terraformRoots'>): number {
  switch (domainId) {
    case 'helm':
      return inspection.helmCharts.length;
    case 'pulumi':
      return inspection.pulumiProjects.length;
    case 'terraform':
      return inspection.terraformRoots.length;
  }
}

export function resolveDomainCapabilities(
  inspection: Pick<WorkspaceInspection, 'helmCharts' | 'pulumiProjects' | 'terraformRoots'>
): DomainCapabilitySummary[] {
  return DOMAIN_DEFINITIONS
    .map(definition => ({
      id: definition.id,
      label: definition.label,
      detectedTargets: countDetectedTargets(definition.id, inspection),
      supportedTaskKinds: definition.supportedTaskKinds,
      boundedEditKinds: definition.boundedEditKinds,
      validatorCommands: definition.validatorCommands
    }))
    .filter(domain => domain.detectedTargets > 0);
}
