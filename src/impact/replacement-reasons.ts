export type ReplacementRuleDomain = 'pulumi' | 'terraform';
export type ReplacementReasonCategory =
  | 'exclusive-identity'
  | 'immutable-target'
  | 'provider-reported'
  | 'resource-address';

export interface ReplacementReason {
  path: string;
  category: ReplacementReasonCategory;
  confidence: 'low' | 'medium' | 'high';
  ruleId: string | null;
  reason: string;
  suggestedAction: string;
}

interface ReplacementPathRule {
  paths: string[];
  category: Exclude<ReplacementReasonCategory, 'provider-reported'>;
  reason: string;
  suggestedAction: string;
}

interface ReplacementRuleSpec {
  id: string;
  label: string;
  pulumiTypes?: string[];
  terraformTypes?: string[];
  pathRules: ReplacementPathRule[];
}

const REVIEW_RENAME_OR_SEQUENCE =
  'If the physical object did not change, review aliases, moved blocks, or state moves; otherwise sequence the replacement explicitly after approval.';

const REPLACEMENT_RULE_SPECS: ReplacementRuleSpec[] = [
  {
    id: 'aws-route',
    label: 'AWS Route',
    pulumiTypes: ['aws:ec2:Route', 'aws:ec2/route:Route'],
    terraformTypes: ['aws_route'],
    pathRules: [
      {
        paths: ['routeTableId', 'route_table_id'],
        category: 'exclusive-identity',
        reason: 'route table is part of the AWS route identity',
        suggestedAction: REVIEW_RENAME_OR_SEQUENCE
      },
      {
        paths: [
          'destinationCidrBlock',
          'destination_cidr_block',
          'destinationIpv6CidrBlock',
          'destination_ipv6_cidr_block',
          'destinationPrefixListId',
          'destination_prefix_list_id'
        ],
        category: 'exclusive-identity',
        reason: 'destination is part of the AWS route identity',
        suggestedAction: REVIEW_RENAME_OR_SEQUENCE
      },
      {
        paths: [
          'carrierGatewayId',
          'carrier_gateway_id',
          'coreNetworkArn',
          'core_network_arn',
          'egressOnlyGatewayId',
          'egress_only_gateway_id',
          'gatewayId',
          'gateway_id',
          'localGatewayId',
          'local_gateway_id',
          'natGatewayId',
          'nat_gateway_id',
          'networkInterfaceId',
          'network_interface_id',
          'transitGatewayId',
          'transit_gateway_id',
          'vpcEndpointId',
          'vpc_endpoint_id',
          'vpcPeeringConnectionId',
          'vpc_peering_connection_id'
        ],
        category: 'immutable-target',
        reason: 'route target changes commonly require replacing the route object while keeping the same route table and destination',
        suggestedAction: 'Check for RouteAlreadyExists risk; use delete-before-create/manual sequencing when the existing route identity is unchanged.'
      }
    ]
  },
  {
    id: 'aws-s3-bucket',
    label: 'AWS S3 Bucket',
    pulumiTypes: ['aws:s3:Bucket', 'aws:s3/bucket:Bucket'],
    terraformTypes: ['aws_s3_bucket'],
    pathRules: [
      {
        paths: ['bucket'],
        category: 'exclusive-identity',
        reason: 'bucket is the globally unique physical bucket name',
        suggestedAction: 'Treat this as a bucket identity change; prefer import/state repair for logical renames and use an explicit migration plan for true replacements.'
      }
    ]
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
      'aws_rds_cluster',
      'aws_sns_topic',
      'aws_sqs_queue'
    ],
    pathRules: [
      {
        paths: [
          'name',
          'functionName',
          'function_name',
          'identifier',
          'repository',
          'queue',
          'topic',
          'clusterIdentifier',
          'cluster_identifier'
        ],
        category: 'exclusive-identity',
        reason: 'name-like field is the provider-visible physical identity',
        suggestedAction: REVIEW_RENAME_OR_SEQUENCE
      }
    ]
  },
  {
    id: 'aws-security-group',
    label: 'AWS Security Group',
    pulumiTypes: ['aws:ec2/securityGroup:SecurityGroup'],
    terraformTypes: ['aws_security_group'],
    pathRules: [
      {
        paths: ['name', 'namePrefix', 'name_prefix'],
        category: 'exclusive-identity',
        reason: 'security group name participates in the physical identity inside a VPC',
        suggestedAction: REVIEW_RENAME_OR_SEQUENCE
      },
      {
        paths: ['vpcId', 'vpc_id'],
        category: 'resource-address',
        reason: 'moving a security group between VPCs creates a different physical attachment boundary',
        suggestedAction: 'Review dependent rules and attachments before accepting the replacement cascade.'
      }
    ]
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
    pathRules: [
      {
        paths: ['metadata.name', 'metadata.0.name'],
        category: 'exclusive-identity',
        reason: 'metadata.name is part of the Kubernetes object identity',
        suggestedAction: REVIEW_RENAME_OR_SEQUENCE
      },
      {
        paths: ['metadata.namespace', 'metadata.0.namespace'],
        category: 'exclusive-identity',
        reason: 'metadata.namespace is part of the Kubernetes object identity',
        suggestedAction: REVIEW_RENAME_OR_SEQUENCE
      }
    ]
  },
  {
    id: 'kubernetes-namespace',
    label: 'Kubernetes Namespace',
    pulumiTypes: ['kubernetes:core/v1:Namespace'],
    terraformTypes: ['kubernetes_namespace'],
    pathRules: [
      {
        paths: ['metadata.name', 'metadata.0.name'],
        category: 'exclusive-identity',
        reason: 'metadata.name is the cluster-scoped namespace identity',
        suggestedAction: REVIEW_RENAME_OR_SEQUENCE
      }
    ]
  }
];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizePath(path: string): string {
  return path.replace(/\[(\d+)\]/g, '.$1');
}

function findReplacementSpec(resourceType: string | null, domain: ReplacementRuleDomain): ReplacementRuleSpec | null {
  if (!resourceType) {
    return null;
  }

  const field = domain === 'pulumi' ? 'pulumiTypes' : 'terraformTypes';
  return REPLACEMENT_RULE_SPECS.find(spec => spec[field]?.includes(resourceType)) ?? null;
}

function pathMatches(candidatePath: string, rulePath: string): boolean {
  const normalizedCandidate = normalizePath(candidatePath);
  const normalizedRule = normalizePath(rulePath);

  return normalizedCandidate === normalizedRule
    || normalizedCandidate.startsWith(`${normalizedRule}.`)
    || normalizedRule.startsWith(`${normalizedCandidate}.`);
}

function findPathRule(spec: ReplacementRuleSpec | null, path: string): ReplacementPathRule | null {
  if (!spec) {
    return null;
  }

  return spec.pathRules.find(rule => rule.paths.some(rulePath => pathMatches(path, rulePath))) ?? null;
}

export function collectReplacementReasons(
  resourceType: string | null,
  domain: ReplacementRuleDomain,
  replacePaths: string[]
): ReplacementReason[] {
  const paths = uniqueStrings(replacePaths.filter(path => path.trim().length > 0));
  if (paths.length === 0) {
    return [];
  }

  const spec = findReplacementSpec(resourceType, domain);
  return paths.map(path => {
    const pathRule = findPathRule(spec, path);
    if (pathRule && spec) {
      return {
        path,
        category: pathRule.category,
        confidence: 'high',
        ruleId: spec.id,
        reason: `${spec.label}: ${pathRule.reason}`,
        suggestedAction: pathRule.suggestedAction
      };
    }

    const typeLabel = resourceType ?? 'unknown resource type';
    return {
      path,
      category: 'provider-reported',
      confidence: spec ? 'medium' : 'low',
      ruleId: spec?.id ?? null,
      reason: `Provider reported replacement for ${typeLabel}.${path}; no provider-specific rule is registered for this path.`,
      suggestedAction: 'Review native plan/preview details and provider schema before treating this as a logical rename or accepted replacement.'
    };
  });
}

export function formatReplacementReasonCategories(reasons: ReplacementReason[]): string {
  return uniqueStrings(reasons.map(reason => reason.category)).join(',');
}

export function formatReplacementReasonPaths(reasons: ReplacementReason[]): string {
  return uniqueStrings(reasons.map(reason => reason.path)).join(',');
}

export function formatReplacementReasonSummary(reasons: ReplacementReason[]): string {
  return reasons.map(reason => `${reason.path}: ${reason.reason}`).join('; ');
}

export function formatReplacementSuggestedActions(reasons: ReplacementReason[]): string {
  return uniqueStrings(reasons.map(reason => reason.suggestedAction)).join('; ');
}
