export interface ExclusiveIdentityGroup {
  key: string;
  paths: string[];
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
  right: Record<string, string>
): string[] {
  return Object.entries(left)
    .filter(([key, value]) => right[key] === value)
    .map(([key]) => key);
}

export function hasCompleteExclusiveIdentityMatch(
  spec: ExclusiveIdentitySpec,
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  return matchingExclusiveIdentityKeys(left, right).length === spec.identityGroups.length;
}
