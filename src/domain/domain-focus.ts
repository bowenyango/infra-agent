import type {
  DomainCapabilitySummary,
  InfraDomainId
} from '../types/repository.ts';

const DOMAIN_PATTERNS: Record<InfraDomainId, RegExp> = {
  helm: /\b(helm|chart|values|template|templates|ingress|probe|probes|readiness|liveness|health|healthcheck)\b/i,
  pulumi: /\b(pulumi|stack|stacks|preview|config|namespace)\b/i,
  terraform: /\b(terraform|tf|tfvars|variable|variables|module|modules|fmt|validate)\b/i
};

export function inferRequestedDomains(
  task: string,
  domainCapabilities: DomainCapabilitySummary[]
): InfraDomainId[] {
  const availableDomains = new Set(domainCapabilities.map(domain => domain.id));
  const requestedDomains: InfraDomainId[] = [];

  for (const [domainId, pattern] of Object.entries(DOMAIN_PATTERNS) as Array<[InfraDomainId, RegExp]>) {
    if (!availableDomains.has(domainId)) {
      continue;
    }

    if (pattern.test(task)) {
      requestedDomains.push(domainId);
    }
  }

  return requestedDomains;
}
