import type { InfraDomainId } from '../types/repository.ts';
import type { EditPlanKind } from '../types/edit-plan.ts';

const DOMAIN_EDIT_PLAN_ORDER: Record<InfraDomainId, EditPlanKind[]> = {
  helm: [
    'helm-service-port-repair',
    'helm-ingress-values-repair',
    'helm-ingress',
    'helm-probes'
  ],
  pulumi: [
    'pulumi-stack-config'
  ],
  terraform: [
    'terraform-tfvars-config'
  ]
};

const DEFAULT_EDIT_PLAN_ORDER: EditPlanKind[] = [
  ...DOMAIN_EDIT_PLAN_ORDER.helm,
  ...DOMAIN_EDIT_PLAN_ORDER.pulumi,
  ...DOMAIN_EDIT_PLAN_ORDER.terraform
];

export function prioritizeEditPlanKinds(requestedDomains: InfraDomainId[]): EditPlanKind[] {
  const orderedKinds: EditPlanKind[] = [];
  const seenKinds = new Set<EditPlanKind>();

  for (const domainId of requestedDomains) {
    for (const kind of DOMAIN_EDIT_PLAN_ORDER[domainId]) {
      if (seenKinds.has(kind)) {
        continue;
      }

      seenKinds.add(kind);
      orderedKinds.push(kind);
    }
  }

  for (const kind of DEFAULT_EDIT_PLAN_ORDER) {
    if (seenKinds.has(kind)) {
      continue;
    }

    seenKinds.add(kind);
    orderedKinds.push(kind);
  }

  return orderedKinds;
}
