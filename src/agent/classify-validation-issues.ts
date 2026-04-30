import type { ValidationCommandOutput } from '../types/tools.ts';
import type { ValidationIssue } from '../types/agent.ts';

type RuntimeIaCEngine = 'pulumi' | 'terraform';

interface RuntimeExclusiveIdentityConflictFacts {
  conflictCode: string;
  conflictFamily: string;
  duplicateIdentity: string | null;
  engine: RuntimeIaCEngine;
  dnsNames: string[];
  listenerArns: string[];
  listenerRulePriorities: string[];
  oidcProviderUrls: string[];
  providerName: string | null;
  recordTypes: string[];
  resourceType: string | null;
  routeDestinations: string[];
  routeTableIds: string[];
  securityGroupIds: string[];
  securityGroupRulePeers: string[];
}

function buildIssue(result: ValidationCommandOutput, issue: Omit<ValidationIssue, 'sourceCommand'>): ValidationIssue {
  return {
    ...issue,
    sourceCommand: result.command
  };
}

function buildTerraformValidateGuidance(output: string): string {
  if (/undeclared (input )?variable/i.test(output)) {
    return 'Read the referenced Terraform root and confirm the variable name exists in variable declarations and tfvars before retrying.';
  }

  if (/missing required argument/i.test(output)) {
    return 'Read the referenced Terraform module inputs and add the missing required argument through an existing tfvars file or declared variable path.';
  }

  if (/unsupported argument/i.test(output)) {
    return 'Compare the failing argument name against the Terraform module variable declarations and remove or rename unsupported keys before retrying.';
  }

  if (/invalid value/i.test(output)) {
    return 'Inspect the failing Terraform variable type and update the tfvars value to match the declared schema before retrying.';
  }

  return 'Read the failing Terraform root, review variable declarations and tfvars, then correct the configuration before rerunning validation.';
}

function extractMissingRequiredTerraformArgument(output: string): string | null {
  const match = output.match(/argument\s+"([^"]+)"\s+is required/i);
  return match?.[1] ?? null;
}

function buildPulumiPreviewGuidance(output: string): string {
  const missingConfigMatch =
    output.match(/missing required configuration (?:key|variable)[^"'`]*["'`]([^"'`]+)["'`]/i)
    ?? output.match(/configuration[^"'`]*["'`]([^"'`]+)["'`][^"'`]*is required/i);

  const missingConfigKey = missingConfigMatch?.[1]?.trim();
  if (missingConfigKey) {
    if (/:imageTag$/i.test(missingConfigKey)) {
      return `Update the selected Pulumi stack file and set ${missingConfigKey} using the existing stack config namespace before rerunning preview.`;
    }

    if (/:environment$/i.test(missingConfigKey)) {
      return `Update the selected Pulumi stack file and set ${missingConfigKey} to the intended environment value before rerunning preview.`;
    }

    return `Update the selected Pulumi stack file and define ${missingConfigKey} using the existing project config shape before rerunning preview.`;
  }

  return 'Read the failing Pulumi project and stack file, then correct the missing or invalid config value before rerunning preview.';
}

function uniqueMatches(output: string, pattern: RegExp): string[] {
  return [...new Set([...output.matchAll(pattern)]
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value)))];
}

function extractPulumiResourceType(output: string): string | null {
  const match = output.match(/(?:^|\n)\s*([A-Za-z0-9_./-]+:[A-Za-z0-9_./-]+(?::[A-Za-z0-9_./-]+)?)\s+\([^)]+\):/);
  return match?.[1]?.trim() ?? null;
}

function extractTerraformAddressResourceType(address: string): string | null {
  const parts = address.split('.');
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (parts[index] === 'module') {
      index += 1;
      continue;
    }

    if (parts[index] === 'data') {
      return parts[index + 1]?.replace(/\[.*$/, '') ?? null;
    }

    return parts[index]?.replace(/\[.*$/, '') ?? null;
  }

  return null;
}

function extractTerraformResourceType(output: string): string | null {
  const resourceBlockMatch = output.match(/\bin resource\s+"([^"]+)"\s+"[^"]+"/i);
  if (resourceBlockMatch?.[1]) {
    return resourceBlockMatch[1].trim();
  }

  const addressMatch = output.match(/\bwith\s+([^,\s]+),?/i);
  if (!addressMatch?.[1]) {
    return null;
  }

  return extractTerraformAddressResourceType(addressMatch[1].trim());
}

function extractDuplicateIdentity(output: string): string | null {
  return output.match(/\b(?:name|bucket|repository|queue|topic|function|role|group|user|domain name|CNAME|alias)\s+["'`]([^"'`]+)["'`][^.\n]*already exists/i)?.[1]?.trim()
    ?? output.match(/\bname=['"`]([^'"`]+)['"`]/i)?.[1]?.trim()
    ?? output.match(/\b([A-Za-z0-9._:/-]+)\s+already exists\b/i)?.[1]?.trim()
    ?? null;
}

function extractDnsNames(output: string): string[] {
  const matches = [
    ...uniqueMatches(output, /\b(?:CNAME|alias|domain name|DNS name|RRSet)[^"'`\n=:(]*["'`(=: ]+((?:\*\.)?[A-Za-z0-9_*-]+(?:\.[A-Za-z0-9_*-]+)+\.?)/gi),
    ...uniqueMatches(output, /\bname=['"`]((?:\*\.)?[A-Za-z0-9_*-]+(?:\.[A-Za-z0-9_*-]+)+\.?)['"`]/gi)
  ];

  return [...new Set(matches)]
    .filter(value => !/amazonaws\.com\.?$/i.test(value))
    .slice(0, 8);
}

function extractRecordTypes(output: string): string[] {
  return uniqueMatches(output, /\btype=['"`]?([A-Z][A-Z0-9_]*)['"`]?/gi).slice(0, 8);
}

function extractListenerArns(output: string): string[] {
  return uniqueMatches(output, /\b(arn:aws[a-z-]*:elasticloadbalancing:[^,\s'")]+)/gi)
    .map(arn => arn.replace(/[.:]+$/g, ''))
    .slice(0, 8);
}

function extractListenerRulePriorities(output: string): string[] {
  return [...new Set([
    ...uniqueMatches(output, /\bpriority\s+['"`]?(\d{1,5})['"`]?/gi),
    ...uniqueMatches(output, /\bPriority\s+['"`](\d{1,5})['"`]/g)
  ])].slice(0, 8);
}

function extractSecurityGroupIds(output: string): string[] {
  return uniqueMatches(output, /\b(sg-[0-9a-f]+)\b/gi).slice(0, 8);
}

function extractSecurityGroupRulePeers(output: string): string[] {
  const peers = [
    ...uniqueMatches(output, /\b((?:\d{1,3}\.){3}\d{1,3}\/\d{1,2})\b/g),
    ...uniqueMatches(output, /\b([0-9a-f:]+::[0-9a-f:/]*)\b/gi),
    ...uniqueMatches(output, /\b(pl-[0-9a-f]+)\b/gi),
    ...uniqueMatches(output, /\bsource security group ['"`]?((?:sg-)?[0-9a-f]+)['"`]?/gi),
    ...uniqueMatches(output, /\bpeer:\s*([^,\n"]+)/gi)
  ];

  return [...new Set(peers)]
    .map(peer => peer.trim())
    .filter(peer => peer.length > 0)
    .slice(0, 8);
}

function extractOidcProviderUrls(output: string): string[] {
  const urls = [
    ...uniqueMatches(output, /\b(https:\/\/[^\s'",)]+)/gi),
    ...uniqueMatches(output, /\boidc-provider\/([A-Za-z0-9._~:/-]+)/gi)
  ];

  return [...new Set(urls.map(url => url.replace(/[.]+$/g, '').trim()))]
    .filter(url => url.length > 0)
    .slice(0, 8);
}

function conflictCodeFromOutput(output: string, resourceType: string | null): string | null {
  const directConflictCode = output.match(/\b(RouteAlreadyExists|BucketAlreadyExists|BucketAlreadyOwnedByYou|EntityAlreadyExists|ResourceAlreadyExistsException|RepositoryAlreadyExistsException|QueueAlreadyExists|TopicAlreadyExists|DBInstanceAlreadyExists|TableAlreadyExistsException|AlreadyExistsException|InvalidGroup\.Duplicate|InvalidPermission\.Duplicate|PriorityInUse|CNAMEAlreadyExists)\b/i)?.[1];
  if (directConflictCode) {
    return directConflictCode;
  }

  const isDomainNameResource = /(?:api)?gateway[^:\n]*\/domainName:DomainName|api_gateway_domain_name|apigatewayv2_domain_name/i.test(resourceType ?? output);
  if (/\bConflictException\b/i.test(output) && isDomainNameResource && /\b(already exists|conflict|domain name)\b/i.test(output)) {
    return 'ConflictException';
  }

  if (/\bInvalidChangeBatch\b/i.test(output) && /\b(already exists|conflicting RRSet|Tried to create resource record set|duplicate)\b/i.test(output)) {
    return 'InvalidChangeBatch';
  }

  return /\balready exists\b/i.test(output) ? 'AlreadyExists' : null;
}

function conflictFamilyFromFacts(params: {
  conflictCode: string;
  output: string;
  resourceType: string | null;
  routeTableIds: string[];
}): string {
  if (params.routeTableIds.length > 0 || params.conflictCode === 'RouteAlreadyExists') {
    return 'aws-route';
  }

  if (params.conflictCode === 'CNAMEAlreadyExists') {
    return 'aws-cloudfront-alias';
  }

  if (params.conflictCode === 'InvalidChangeBatch') {
    return 'aws-route53-record';
  }

  if (params.conflictCode === 'InvalidPermission.Duplicate' && /security.?group|SecurityGroup(?:Ingress|Egress)?Rule|permission/i.test(params.resourceType ?? params.output)) {
    return 'aws-security-group-rule';
  }

  if (params.conflictCode === 'PriorityInUse' && /listener.?rule|ListenerRule|priority/i.test(params.resourceType ?? params.output)) {
    return 'aws-lb-listener-rule';
  }

  if (params.conflictCode === 'EntityAlreadyExists' && /open.?id.?connect|oidc|oidc-provider|OpenIdConnectProvider/i.test(params.resourceType ?? params.output)) {
    return 'aws-iam-oidc-provider';
  }

  if (params.conflictCode === 'ConflictException' && /domainName:DomainName|domain name|custom domain/i.test(params.resourceType ?? params.output)) {
    return 'aws-api-gateway-domain-name';
  }

  return 'exclusive-identity';
}

function extractRuntimeExclusiveIdentityConflictFacts(
  output: string,
  engine: RuntimeIaCEngine
): RuntimeExclusiveIdentityConflictFacts | null {
  const resourceType = engine === 'pulumi'
    ? extractPulumiResourceType(output)
    : extractTerraformResourceType(output);
  const conflictCode = conflictCodeFromOutput(output, resourceType);

  if (!conflictCode) {
    return null;
  }

  const routeTableIds = uniqueMatches(output, /Route Table \((rtb-[^)]+)\)/gi);
  const routeDestinations = uniqueMatches(output, /destination \(([^)]+)\)/gi);
  const providerName = output.match(/\bprovider=([^\s]+)/i)?.[1]?.trim() ?? null;

  return {
    conflictCode,
    conflictFamily: conflictFamilyFromFacts({
      conflictCode,
      output,
      resourceType,
      routeTableIds
    }),
    duplicateIdentity: extractDuplicateIdentity(output),
    engine,
    dnsNames: extractDnsNames(output),
    listenerArns: extractListenerArns(output),
    listenerRulePriorities: extractListenerRulePriorities(output),
    oidcProviderUrls: extractOidcProviderUrls(output),
    providerName,
    recordTypes: extractRecordTypes(output),
    resourceType,
    routeDestinations,
    routeTableIds,
    securityGroupIds: extractSecurityGroupIds(output),
    securityGroupRulePeers: extractSecurityGroupRulePeers(output)
  };
}

function runtimeEngineLabel(engine: RuntimeIaCEngine): string {
  return engine === 'terraform' ? 'Terraform' : 'Pulumi';
}

function logicalIdentityRepairText(engine: RuntimeIaCEngine): string {
  return engine === 'terraform'
    ? 'use moved blocks, reviewed terraform state mv, import, or state repair for logical adoption or renames'
    : 'use aliases/import/state repair for logical adoption or renames';
}

function adoptionRepairText(engine: RuntimeIaCEngine): string {
  return engine === 'terraform'
    ? 'Use moved blocks, reviewed terraform state mv, import, or state repair for logical adoption or renames'
    : 'Use aliases/import/state repair for logical adoption or renames';
}

function oidcRepairText(engine: RuntimeIaCEngine): string {
  return engine === 'terraform'
    ? 'use import/state repair, moved blocks, or reviewed terraform state mv for logical adoption/renames'
    : 'use import/state repair or aliases for logical adoption/renames';
}

function replacementSequencingText(engine: RuntimeIaCEngine): string {
  return engine === 'terraform'
    ? 'review lifecycle create_before_destroy and explicitly sequence delete-before-create replacement after approval'
    : 'use deleteBeforeReplace or manually sequence the replacement with accepted downtime';
}

function buildRuntimeExclusiveIdentityConflictGuidance(facts: RuntimeExclusiveIdentityConflictFacts): string {
  const engine = runtimeEngineLabel(facts.engine);
  const routeTableText = facts.routeTableIds.length > 0 ? ` in route table(s) ${facts.routeTableIds.join(', ')}` : '';
  const destinationText = facts.routeDestinations.length > 0 ? ` for destination(s) ${facts.routeDestinations.join(', ')}` : '';
  const resourceText = facts.resourceType ? ` ${facts.resourceType}` : '';
  const identityText = facts.duplicateIdentity ? ` for identity ${facts.duplicateIdentity}` : '';
  const logicalIdentityRepair = logicalIdentityRepairText(facts.engine);
  const replacementSequencing = replacementSequencingText(facts.engine);

  if (facts.conflictFamily === 'aws-cloudfront-alias') {
    const aliasText = facts.dnsNames.length > 0 ? ` (${facts.dnsNames.join(', ')})` : '';
    return `${engine} attempted to create a CloudFront distribution alias/CNAME${aliasText} before the existing distribution released it, and the provider returned ${facts.conflictCode}. Review the plan/preview for delete/create or replacement pairs that share aliases; use aliases, moved blocks, or state moves for logical renames, or explicitly remove/move the old alias before creating the replacement distribution. Run refresh/import/state repair only with explicit approval.`;
  }

  if (facts.conflictFamily === 'aws-api-gateway-domain-name') {
    const domainText = facts.dnsNames.length > 0 ? ` (${facts.dnsNames.join(', ')})` : identityText;
    return `${engine} attempted to create an API Gateway custom domain${domainText} before deleting or moving the existing domain, and the provider returned ${facts.conflictCode}. Review the plan/preview for matching domainName identity: ${logicalIdentityRepair}, ${replacementSequencing} for true replacements, and state/import repair only with explicit approval.`;
  }

  if (facts.conflictFamily === 'aws-route53-record') {
    const dnsText = facts.dnsNames.length > 0 ? ` ${facts.dnsNames.join(', ')}` : '';
    const typeText = facts.recordTypes.length > 0 ? ` type(s) ${facts.recordTypes.join(', ')}` : '';
    return `${engine} attempted to create a Route53 record set${dnsText}${typeText} that conflicts with an existing record, and the provider returned ${facts.conflictCode}. This is common for ACM validation CNAMEs and logical record moves. Review the plan/preview for matching hosted zone, name, type, and set identifier; prefer import/state repair for logical moves, use allowOverwrite only after DNS ownership review, or explicitly sequence delete-before-create after approval.`;
  }

  if (facts.conflictFamily === 'aws-security-group-rule') {
    const groupText = facts.securityGroupIds.length > 0 ? ` in security group(s) ${facts.securityGroupIds.join(', ')}` : '';
    const peerText = facts.securityGroupRulePeers.length > 0 ? ` for peer(s) ${facts.securityGroupRulePeers.join(', ')}` : '';
    return `${engine} attempted to create a security group rule${groupText}${peerText} before the existing duplicate permission was deleted or adopted, and the provider returned ${facts.conflictCode}. Review the plan/preview for matching direction, protocol, port range, security group, and peer. ${adoptionRepairText(facts.engine)}, avoid mixing inline, legacy, and VPC-style rule managers for the same group, or explicitly sequence delete-before-create after approval.`;
  }

  if (facts.conflictFamily === 'aws-lb-listener-rule') {
    const listenerText = facts.listenerArns.length > 0 ? ` on listener(s) ${facts.listenerArns.join(', ')}` : '';
    const priorityText = facts.listenerRulePriorities.length > 0 ? ` for priority ${facts.listenerRulePriorities.join(', ')}` : '';
    return `${engine} attempted to create a load balancer listener rule${listenerText}${priorityText} before the existing rule priority was moved or removed, and the provider returned ${facts.conflictCode}. Review the plan/preview for matching listenerArn and priority. ${adoptionRepairText(facts.engine)}, choose a free priority for coexistence, or explicitly sequence old rule removal before creating the replacement after approval.`;
  }

  if (facts.conflictFamily === 'aws-iam-oidc-provider') {
    const providerText = facts.oidcProviderUrls.length > 0 ? ` (${facts.oidcProviderUrls.join(', ')})` : identityText;
    return `${engine} attempted to create an IAM OIDC provider${providerText} before the existing provider was adopted, moved, or removed, and the provider returned ${facts.conflictCode}. IAM OIDC provider URLs are account-unique; review role trust policies that reference the provider, ${oidcRepairText(facts.engine)}, and sequence replacement only after approval.`;
  }

  return `${engine} attempted to create an exclusive${resourceText} resource${routeTableText}${destinationText}${identityText} before deleting the existing object, and the provider returned ${facts.conflictCode}. Review the plan/preview for delete/create or replacement pairs with the same provider identity: if this is a logical rename, ${logicalIdentityRepair}; if the resource must be replaced, ${replacementSequencing}; if the failed update already changed cloud or state, run refresh/import/state repair only with explicit approval.`;
}

function buildRuntimeExclusiveIdentityConflictMetadata(
  facts: RuntimeExclusiveIdentityConflictFacts
): NonNullable<ValidationIssue['metadata']> {
  return {
    conflictCode: facts.conflictCode,
    conflictFamily: facts.conflictFamily,
    duplicateIdentity: facts.duplicateIdentity ?? undefined,
    dnsNames: facts.dnsNames.join(','),
    listenerArns: facts.listenerArns.join(','),
    listenerRulePriorities: facts.listenerRulePriorities.join(','),
    oidcProviderUrls: facts.oidcProviderUrls.join(','),
    providerName: facts.providerName ?? undefined,
    recordTypes: facts.recordTypes.join(','),
    resourceType: facts.resourceType ?? undefined,
    routeDestinations: facts.routeDestinations.join(','),
    routeTableIds: facts.routeTableIds.join(','),
    securityGroupIds: facts.securityGroupIds.join(','),
    securityGroupRulePeers: facts.securityGroupRulePeers.join(',')
  };
}

function buildHelmValidationGuidance(kind: 'service-port' | 'ingress-values'): string {
  if (kind === 'service-port') {
    return 'Read the selected Helm chart values and define service.port in values.yaml before rerunning helm lint or helm template.';
  }

  return 'Read the selected Helm chart values and define the ingress block in values.yaml before rerunning helm lint or helm template.';
}

function extractYamlValidationPath(command: string): string | null {
  const match = command.match(/^infra-agent yaml-parse (.+)$/);
  return match?.[1]?.trim() ?? null;
}

export function classifyValidationIssues(results: ValidationCommandOutput[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const result of results) {
    if (result.exitCode === 0) {
      continue;
    }

    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    const yamlPath = extractYamlValidationPath(result.command);

    if (yamlPath) {
      const parserMatch = combinedOutput.match(/\b(parser|using):\s*([A-Za-z0-9:_-]+)/i);
      issues.push(buildIssue(result, {
        kind: 'yaml-syntax-failure',
        repairable: false,
        message: combinedOutput.trim().slice(0, 400) || `YAML syntax validation failed for ${yamlPath}.`,
        guidance: `Fix the planned YAML content for ${yamlPath} before applying the write. Do not continue to Helm, Pulumi, or Terraform validation until the file parses as YAML.`,
        metadata: {
          yamlPath,
          yamlParser: parserMatch?.[2]
        }
      }));
      continue;
    }

    if (/service\.port/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'helm-missing-service-port',
        repairable: true,
        message: 'Validation failed because a Helm template references .Values.service.port but the values file does not define it.',
        guidance: buildHelmValidationGuidance('service-port')
      }));
      continue;
    }

    if (/ingress\.enabled/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'helm-missing-ingress-values',
        repairable: true,
        message: 'Validation failed because a Helm template references .Values.ingress.enabled but the values file does not define ingress settings.',
        guidance: buildHelmValidationGuidance('ingress-values')
      }));
      continue;
    }

    if (/terraform\b.*fmt\b.*-check/i.test(result.command) || /terraform fmt/i.test(combinedOutput)) {
      issues.push(buildIssue(result, {
        kind: 'terraform-formatting-required',
        repairable: true,
        message: 'Terraform formatting validation failed. The selected Terraform root can be repaired with a bounded terraform fmt pass.'
      }));
      continue;
    }

    if (/terraform\b.*validate/i.test(result.command)) {
      const missingVariableName = extractMissingRequiredTerraformArgument(combinedOutput);
      issues.push(buildIssue(result, {
        kind: 'terraform-validate-failure',
        repairable: Boolean(missingVariableName),
        message: combinedOutput.trim().slice(0, 400) || 'Terraform validate reported a configuration error.',
        guidance: buildTerraformValidateGuidance(combinedOutput),
        metadata: missingVariableName
          ? {
              missingVariableName
            }
          : undefined
      }));
      continue;
    }

    if (/terraform\b.*(?:plan|apply)/i.test(result.command)) {
      const createBeforeDeleteConflictFacts = extractRuntimeExclusiveIdentityConflictFacts(combinedOutput, 'terraform');

      if (createBeforeDeleteConflictFacts) {
        issues.push(buildIssue(result, {
          kind: 'terraform-create-before-delete-conflict',
          repairable: false,
          message: combinedOutput.trim().slice(0, 400) || 'Terraform failed because a resource with the same provider identity already exists.',
          guidance: buildRuntimeExclusiveIdentityConflictGuidance(createBeforeDeleteConflictFacts),
          metadata: buildRuntimeExclusiveIdentityConflictMetadata(createBeforeDeleteConflictFacts)
        }));
        continue;
      }
    }

    if (/pulumi\b.*(?:preview|up|update)/i.test(result.command)) {
      const missingConfigMatch =
        combinedOutput.match(/missing required configuration (?:key|variable)[^"'`]*["'`]([^"'`]+)["'`]/i)
        ?? combinedOutput.match(/configuration[^"'`]*["'`]([^"'`]+)["'`][^"'`]*is required/i);
      const createBeforeDeleteConflictFacts = extractRuntimeExclusiveIdentityConflictFacts(combinedOutput, 'pulumi');

      if (createBeforeDeleteConflictFacts) {
        issues.push(buildIssue(result, {
          kind: 'pulumi-create-before-delete-conflict',
          repairable: false,
          message: combinedOutput.trim().slice(0, 400) || 'Pulumi failed because a resource with the same provider identity already exists.',
          guidance: buildRuntimeExclusiveIdentityConflictGuidance(createBeforeDeleteConflictFacts),
          metadata: buildRuntimeExclusiveIdentityConflictMetadata(createBeforeDeleteConflictFacts)
        }));
        continue;
      }

      issues.push(buildIssue(result, {
        kind: missingConfigMatch ? 'pulumi-missing-config' : 'pulumi-preview-failure',
        repairable: Boolean(missingConfigMatch),
        message: combinedOutput.trim().slice(0, 400) || 'Pulumi preview reported a configuration error.',
        guidance: buildPulumiPreviewGuidance(combinedOutput),
        metadata: missingConfigMatch?.[1]
          ? {
              missingConfigKey: missingConfigMatch[1].trim()
            }
          : undefined
      }));
      continue;
    }

    issues.push(buildIssue(result, {
      kind: 'unknown-validation-failure',
      repairable: false,
      message: combinedOutput.trim().slice(0, 400) || 'Validation failed with an unclassified error.'
    }));
  }

  return issues;
}
