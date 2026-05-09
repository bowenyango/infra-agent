export interface UnsafeValidationCommand {
  reason: string;
  matchedPattern: string;
}

interface UnsafeValidationCommandRule {
  id: string;
  pattern: RegExp;
  reason: string;
}

const UNSAFE_VALIDATION_COMMAND_RULES: UnsafeValidationCommandRule[] = [
  {
    id: 'shell-filesystem-mutation',
    pattern: /^(?:mkdir|rm|mv|cp|touch|chmod|chown|ln)\b/i,
    reason: 'Shell filesystem mutation commands are setup or write operations, not validation.'
  },
  {
    id: 'terraform-apply-destroy',
    pattern: /\bterraform\b.*\b(?:apply|destroy)\b/i,
    reason: 'Terraform apply and destroy commands are deploy/state mutation operations, not validation.'
  },
  {
    id: 'terraform-import-state',
    pattern: /\bterraform\b.*\b(?:import|state\s+(?:mv|rm|push|replace-provider))\b/i,
    reason: 'Terraform import and state mutation commands require explicit human review and are not validation.'
  },
  {
    id: 'pulumi-update-destroy',
    pattern: /\bpulumi\b.*\b(?:up|update|destroy)\b/i,
    reason: 'Pulumi update and destroy commands are deployment operations, not validation.'
  },
  {
    id: 'pulumi-import-refresh-state',
    pattern: /\bpulumi\b.*\b(?:import|refresh|state\s+\S+|stack\s+(?:export|import|rm))\b/i,
    reason: 'Pulumi import, refresh, stack removal/export/import, and state commands require explicit review and are not validation.'
  },
  {
    id: 'pulumi-stack-bootstrap',
    pattern: /\bpulumi\b.*\bstack\s+(?:init|select|rename|change-secrets-provider|tag\s+(?:set|rm))\b/i,
    reason: 'Pulumi stack bootstrap, selection, rename, secret-provider, and tag mutations are setup or state operations, not validation.'
  },
  {
    id: 'pulumi-login',
    pattern: /\bpulumi\b.*\blogin\b/i,
    reason: 'Pulumi login changes backend/session state and is not validation.'
  },
  {
    id: 'pulumi-config-mutation',
    pattern: /\bpulumi\b.*\bconfig\s+(?:set|rm|refresh|cp)\b/i,
    reason: 'Pulumi config mutation commands require explicit approval and are not validation.'
  },
  {
    id: 'helm-release-mutation',
    pattern: /\bhelm\b.*\b(?:upgrade|install|uninstall|delete|rollback)\b/i,
    reason: 'Helm release mutation commands are deployment operations, not validation.'
  },
  {
    id: 'kubectl-mutation',
    pattern: /\bkubectl\b.*\b(?:apply|delete|replace|patch|create|scale|rollout|cordon|drain|taint|annotate|label|edit)\b/i,
    reason: 'kubectl mutation commands can change cluster state and are not validation.'
  }
];

function splitShellSegments(command: string): string[] {
  return command
    .split(/(?:&&|\|\||[;|()])/)
    .map(segment => segment.trim())
    .filter(Boolean);
}

function stripLeadingEnvironmentAssignments(segment: string): string {
  const tokens = segment.trim().split(/\s+/);

  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[0] ?? '')) {
    tokens.shift();
  }

  return tokens.join(' ');
}

export function classifyUnsafeValidationCommand(command: string): UnsafeValidationCommand | null {
  for (const rawSegment of splitShellSegments(command)) {
    const segment = stripLeadingEnvironmentAssignments(rawSegment);
    for (const rule of UNSAFE_VALIDATION_COMMAND_RULES) {
      if (rule.pattern.test(segment)) {
        return {
          reason: rule.reason,
          matchedPattern: rule.id
        };
      }
    }
  }

  return null;
}
