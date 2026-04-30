export interface ExclusiveIdentityGroup {
  key: string;
  paths: string[];
  combine?: boolean;
  omitWhen?: {
    key: string;
    values: string[];
  };
  optional?: boolean;
  match?: 'exact' | 'overlap';
}

export interface ExclusiveIdentitySpec {
  id: string;
  label: string;
  pulumiTypes?: string[];
  terraformTypes?: string[];
  identityGroups: ExclusiveIdentityGroup[];
  targetPaths?: string[];
  conflictError: string;
  suggestedAction: string;
}

export type ExclusiveIdentityDomain = 'pulumi' | 'terraform';

export const EXCLUSIVE_IDENTITY_SPECS: ExclusiveIdentitySpec[] = [
  {
    id: 'aws-route',
    label: 'AWS Route',
    pulumiTypes: ['aws:ec2:Route', 'aws:ec2/route:Route'],
    terraformTypes: ['aws_route'],
    identityGroups: [
      { key: 'routeTableId', paths: ['routeTableId', 'route_table_id'] },
      { key: 'destination', paths: ['destinationCidrBlock', 'destination_cidr_block', 'destinationIpv6CidrBlock', 'destination_ipv6_cidr_block', 'destinationPrefixListId', 'destination_prefix_list_id'] }
    ],
    targetPaths: ['carrierGatewayId', 'carrier_gateway_id', 'coreNetworkArn', 'core_network_arn', 'egressOnlyGatewayId', 'egress_only_gateway_id', 'gatewayId', 'gateway_id', 'localGatewayId', 'local_gateway_id', 'natGatewayId', 'nat_gateway_id', 'networkInterfaceId', 'network_interface_id', 'transitGatewayId', 'transit_gateway_id', 'vpcEndpointId', 'vpc_endpoint_id', 'vpcPeeringConnectionId', 'vpc_peering_connection_id'],
    conflictError: 'RouteAlreadyExists',
    suggestedAction: 'Use an IaC-native rename mapping for logical renames, or explicitly sequence delete-before-create replacement only when the temporary route removal is acceptable.'
  },
  {
    id: 'aws-named-resource',
    label: 'AWS named resource',
    pulumiTypes: [
      'aws:cloudwatch/logGroup:LogGroup',
      'aws:dynamodb/table:Table',
      'aws:ecr/repository:Repository',
      'aws:iam/group:Group',
      'aws:iam/policy:Policy',
      'aws:iam/role:Role',
      'aws:iam/user:User',
      'aws:lambda/function:Function',
      'aws:lb/loadBalancer:LoadBalancer',
      'aws:lb/targetGroup:TargetGroup',
      'aws:rds/cluster:Cluster',
      'aws:rds/instance:Instance',
      'aws:sns/topic:Topic',
      'aws:sqs/queue:Queue'
    ],
    terraformTypes: [
      'aws_cloudwatch_log_group',
      'aws_db_instance',
      'aws_dynamodb_table',
      'aws_ecr_repository',
      'aws_iam_group',
      'aws_iam_policy',
      'aws_iam_role',
      'aws_iam_user',
      'aws_lambda_function',
      'aws_lb',
      'aws_lb_target_group',
      'aws_rds_cluster',
      'aws_sns_topic',
      'aws_sqs_queue'
    ],
    identityGroups: [
      { key: 'name', paths: ['name', 'functionName', 'function_name', 'identifier', 'clusterIdentifier', 'cluster_identifier', 'repository', 'queue', 'topic'] }
    ],
    conflictError: 'AlreadyExists',
    suggestedAction: 'Use an IaC-native rename mapping for logical renames, or explicitly sequence replacement with delete-before-create/import/state repair after approval.'
  },
  {
    id: 'aws-lb-listener-rule',
    label: 'AWS Load Balancer Listener Rule',
    pulumiTypes: ['aws:lb/listenerRule:ListenerRule'],
    terraformTypes: ['aws_lb_listener_rule'],
    identityGroups: [
      { key: 'listenerArn', paths: ['listenerArn', 'listener_arn'] },
      { key: 'priority', paths: ['priority'] }
    ],
    conflictError: 'PriorityInUse',
    suggestedAction: 'Use an IaC-native rename mapping for logical renames, or explicitly sequence/delete the old rule before creating a new rule with the same listener priority.'
  },
  {
    id: 'aws-security-group-rule',
    label: 'AWS Security Group Rule',
    pulumiTypes: [
      'aws:ec2:SecurityGroupRule',
      'aws:ec2/securityGroupRule:SecurityGroupRule'
    ],
    terraformTypes: ['aws_security_group_rule'],
    identityGroups: [
      { key: 'securityGroupId', paths: ['securityGroupId', 'security_group_id'] },
      { key: 'type', paths: ['type'] },
      { key: 'protocol', paths: ['protocol'] },
      { key: 'fromPort', paths: ['fromPort', 'from_port'] },
      { key: 'toPort', paths: ['toPort', 'to_port'] },
      {
        key: 'source',
        paths: ['cidrBlocks', 'cidr_blocks', 'ipv6CidrBlocks', 'ipv6_cidr_blocks', 'prefixListIds', 'prefix_list_ids', 'sourceSecurityGroupId', 'source_security_group_id', 'self'],
        combine: true,
        match: 'overlap'
      }
    ],
    conflictError: 'InvalidPermission.Duplicate',
    suggestedAction: 'Security group rules are exclusive by group, direction, protocol, ports, and traffic source. Use import/state repair for logical moves, or explicitly remove/sequence the old rule before creating a duplicate permission.'
  },
  {
    id: 'aws-vpc-security-group-rule',
    label: 'AWS VPC Security Group Rule',
    pulumiTypes: [
      'aws:vpc:SecurityGroupIngressRule',
      'aws:vpc/securityGroupIngressRule:SecurityGroupIngressRule',
      'aws:vpc:SecurityGroupEgressRule',
      'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule'
    ],
    terraformTypes: [
      'aws_vpc_security_group_ingress_rule',
      'aws_vpc_security_group_egress_rule'
    ],
    identityGroups: [
      { key: 'securityGroupId', paths: ['securityGroupId', 'security_group_id'] },
      { key: 'ipProtocol', paths: ['ipProtocol', 'ip_protocol'] },
      { key: 'fromPort', paths: ['fromPort', 'from_port'], omitWhen: { key: 'ipProtocol', values: ['-1', 'icmpv6'] } },
      { key: 'toPort', paths: ['toPort', 'to_port'], omitWhen: { key: 'ipProtocol', values: ['-1', 'icmpv6'] } },
      {
        key: 'peer',
        paths: ['cidrIpv4', 'cidr_ipv4', 'cidrIpv6', 'cidr_ipv6', 'prefixListId', 'prefix_list_id', 'referencedSecurityGroupId', 'referenced_security_group_id'],
        combine: true,
        match: 'overlap'
      }
    ],
    conflictError: 'InvalidPermission.Duplicate',
    suggestedAction: 'VPC security group rule resources are exclusive by group, direction, protocol, ports, and one traffic peer. Use import/state repair for logical adoption, or sequence duplicate permission replacement after reviewing source/destination scope.'
  },
  {
    id: 'aws-cloudfront-alias',
    label: 'AWS CloudFront distribution alias',
    pulumiTypes: ['aws:cloudfront/distribution:Distribution'],
    terraformTypes: ['aws_cloudfront_distribution'],
    identityGroups: [
      { key: 'aliases', paths: ['aliases'], match: 'overlap' }
    ],
    conflictError: 'CNAMEAlreadyExists',
    suggestedAction: 'CloudFront aliases are globally exclusive. For logical renames, move state/aliases explicitly; for true replacements, remove or move the old alias before creating the replacement distribution.'
  },
  {
    id: 'aws-api-gateway-domain-name',
    label: 'AWS API Gateway custom domain',
    pulumiTypes: [
      'aws:apigateway/domainName:DomainName',
      'aws:apigatewayv2/domainName:DomainName'
    ],
    terraformTypes: [
      'aws_api_gateway_domain_name',
      'aws_apigatewayv2_domain_name'
    ],
    identityGroups: [
      { key: 'domainName', paths: ['domainName', 'domain_name'] }
    ],
    conflictError: 'ConflictException',
    suggestedAction: 'API Gateway custom domains are account/region exclusive. Use aliases/moved blocks for logical renames, or explicitly sequence old-domain removal before recreating the same domain name.'
  },
  {
    id: 'aws-route53-record',
    label: 'AWS Route53 record',
    pulumiTypes: ['aws:route53/record:Record'],
    terraformTypes: ['aws_route53_record'],
    identityGroups: [
      { key: 'zoneId', paths: ['zoneId', 'zone_id'] },
      { key: 'name', paths: ['name', 'fqdn'] },
      { key: 'type', paths: ['type'] },
      { key: 'setIdentifier', paths: ['setIdentifier', 'set_identifier'], optional: true }
    ],
    conflictError: 'InvalidChangeBatch',
    suggestedAction: 'Route53 record sets are exclusive by hosted zone, record name, type, and routing identifier when present. For ACM validation CNAMEs or other logical moves, use state moves/imports; otherwise sequence delete-before-create after DNS impact review.'
  },
  {
    id: 'aws-iam-oidc-provider',
    label: 'AWS IAM OIDC provider',
    pulumiTypes: [
      'aws:iam:OpenIdConnectProvider',
      'aws:iam/openIdConnectProvider:OpenIdConnectProvider'
    ],
    terraformTypes: ['aws_iam_openid_connect_provider'],
    identityGroups: [
      { key: 'url', paths: ['url'] }
    ],
    conflictError: 'EntityAlreadyExists',
    suggestedAction: 'IAM OIDC provider URLs are exclusive within an AWS account. Use import/state repair for logical adoption or renames, and sequence replacement only after reviewing IAM trust policy consumers.'
  },
  {
    id: 'aws-s3-bucket',
    label: 'AWS S3 Bucket',
    pulumiTypes: ['aws:s3:Bucket', 'aws:s3/bucket:Bucket'],
    terraformTypes: ['aws_s3_bucket'],
    identityGroups: [
      { key: 'bucket', paths: ['bucket'] }
    ],
    conflictError: 'BucketAlreadyExists',
    suggestedAction: 'Use an IaC-native rename mapping for logical renames; replacing a physical bucket usually needs an explicit migration/import/state repair plan.'
  },
  {
    id: 'kubernetes-namespaced-object',
    label: 'Kubernetes namespaced object',
    pulumiTypes: [
      'kubernetes:apps/v1:Deployment',
      'kubernetes:core/v1:ConfigMap',
      'kubernetes:core/v1:Secret',
      'kubernetes:core/v1:Service',
      'kubernetes:networking.k8s.io/v1:Ingress'
    ],
    terraformTypes: [
      'kubernetes_config_map',
      'kubernetes_deployment',
      'kubernetes_ingress_v1',
      'kubernetes_secret',
      'kubernetes_service'
    ],
    identityGroups: [
      { key: 'metadata.name', paths: ['metadata.name', 'metadata.0.name'] },
      { key: 'metadata.namespace', paths: ['metadata.namespace', 'metadata.0.namespace'] }
    ],
    conflictError: 'AlreadyExists',
    suggestedAction: 'Use an IaC-native rename mapping for logical renames, or explicitly sequence replacement with accepted temporary object removal.'
  },
  {
    id: 'kubernetes-namespace',
    label: 'Kubernetes Namespace',
    pulumiTypes: ['kubernetes:core/v1:Namespace'],
    terraformTypes: ['kubernetes_namespace'],
    identityGroups: [
      { key: 'metadata.name', paths: ['metadata.name', 'metadata.0.name'] }
    ],
    conflictError: 'AlreadyExists',
    suggestedAction: 'Use an IaC-native rename mapping for logical renames, or use import/state repair or an explicitly approved replacement plan.'
  }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function identityString(value: unknown): string | null {
  if (Array.isArray(value)) {
    const values = value
      .map(entry => identityString(entry))
      .filter((entry): entry is string => Boolean(entry));
    const unique = [...new Set(values)].sort();
    return unique.length > 0 ? unique.join('|') : null;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function getPathValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (Array.isArray(current)) {
      const index = Number(part);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (isRecord(current)) {
      return current[part];
    }

    return undefined;
  }, value);
}

export function findExclusiveIdentitySpec(
  resourceType: string | null,
  domain: ExclusiveIdentityDomain
): ExclusiveIdentitySpec | null {
  if (!resourceType) {
    return null;
  }

  const field = domain === 'pulumi' ? 'pulumiTypes' : 'terraformTypes';
  return EXCLUSIVE_IDENTITY_SPECS.find(spec => spec[field]?.includes(resourceType)) ?? null;
}

export function collectExclusiveIdentityValues(
  value: unknown,
  spec: ExclusiveIdentitySpec | null
): Record<string, string> {
  if (!isRecord(value) || !spec) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const group of spec.identityGroups) {
    if (group.combine) {
      const combinedValues = group.paths
        .map(path => identityString(getPathValue(value, path)))
        .filter((identityValue): identityValue is string => Boolean(identityValue))
        .flatMap(identityValue => identityValue.split('|'))
        .filter(identityValue => identityValue.length > 0);
      const combinedIdentity = identityString(combinedValues);
      if (combinedIdentity) {
        values[group.key] = combinedIdentity;
      }
      continue;
    }

    for (const path of group.paths) {
      const identityValue = identityString(getPathValue(value, path));
      if (identityValue) {
        values[group.key] = identityValue;
        break;
      }
    }
  }

  return values;
}

export function collectExclusiveTargetValues(
  value: unknown,
  spec: ExclusiveIdentitySpec | null
): Record<string, string> {
  if (!isRecord(value) || !spec?.targetPaths) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const targetPath of spec.targetPaths) {
    const target = identityString(getPathValue(value, targetPath));
    if (target) {
      values[targetPath] = target;
    }
  }

  return values;
}

export function formatExclusiveIdentityValues(values: Record<string, string>): string {
  return Object.entries(values).map(([key, value]) => `${key}=${value}`).join(',');
}

export function formatExclusiveTargetValues(values: Record<string, string>): string {
  return Object.entries(values).map(([key, value]) => `${key}=${value}`).join(',');
}

export function matchingExclusiveIdentityKeys(
  left: Record<string, string>,
  right: Record<string, string>,
  spec?: ExclusiveIdentitySpec
): string[] {
  if (spec) {
    return spec.identityGroups
      .filter(group => {
        const leftValue = left[group.key];
        const rightValue = right[group.key];
        return Boolean(leftValue && rightValue && exclusiveIdentityValuesMatch(group, leftValue, rightValue));
      })
      .map(group => group.key);
  }

  return Object.entries(left)
    .filter(([key, value]) => right[key] === value)
    .map(([key]) => key);
}

function exclusiveIdentityValuesMatch(group: ExclusiveIdentityGroup, left: string, right: string): boolean {
  if (group.match !== 'overlap') {
    return left === right;
  }

  const rightValues = new Set(right.split('|').filter(value => value.length > 0));
  return left.split('|').some(value => rightValues.has(value));
}

function canOmitExclusiveIdentityGroup(
  group: ExclusiveIdentityGroup,
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  if (!group.omitWhen || left[group.key] || right[group.key]) {
    return false;
  }

  const leftControlValue = left[group.omitWhen.key]?.toLowerCase();
  const rightControlValue = right[group.omitWhen.key]?.toLowerCase();
  const omitValues = new Set(group.omitWhen.values.map(value => value.toLowerCase()));
  return Boolean(leftControlValue && rightControlValue && leftControlValue === rightControlValue && omitValues.has(leftControlValue));
}

export function hasCompleteExclusiveIdentityMatch(
  spec: ExclusiveIdentitySpec,
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  for (const group of spec.identityGroups) {
    const leftValue = left[group.key];
    const rightValue = right[group.key];

    if (canOmitExclusiveIdentityGroup(group, left, right)) {
      continue;
    }

    if (group.optional) {
      if (leftValue && rightValue && !exclusiveIdentityValuesMatch(group, leftValue, rightValue)) {
        return false;
      }
      continue;
    }

    if (!leftValue || !rightValue || !exclusiveIdentityValuesMatch(group, leftValue, rightValue)) {
      return false;
    }
  }

  return true;
}
