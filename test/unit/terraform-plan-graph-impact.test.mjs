import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildGraphSnapshotBaseGraph,
  buildGraphSnapshotTerraformPlan,
  buildGraphSnapshotPulumiPreview
} from '../support/graph-fixtures.mjs';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { summarizeInfraGraphImpact } from '../../src/cli/output.ts';
import { buildStableInfraGraphSnapshot } from '../../src/impact/graph-snapshot.ts';
import { normalizeInfraGraphImpactReviewTargets } from '../../src/impact/graph-impact-summary.ts';
import {
  buildWorkspaceInfraGraph,
  summarizeInfraGraph
} from '../../src/impact/workspace-graph.ts';
import {
  attachTerraformPlanToGraph,
  parseTerraformPlanResourceChanges
} from '../../src/impact/terraform-plan-graph.ts';
import {
  attachPulumiPreviewToGraph,
  parsePulumiPreviewResourceChanges
} from '../../src/impact/pulumi-preview-graph.ts';

test('Terraform plan impact attaches resource change nodes to the infra graph', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_instance.api',
        mode: 'managed',
        type: 'aws_instance',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['ami'], ['tags', 'Name']]
        },
        action_reason: 'replace_because_cannot_update'
      },
      {
        address: 'aws_security_group.api',
        mode: 'managed',
        type: 'aws_security_group',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['update']
        }
      },
      {
        address: 'data.aws_caller_identity.current',
        mode: 'data',
        type: 'aws_caller_identity',
        name: 'current',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['no-op']
        }
      }
    ]
  };

  const changes = parseTerraformPlanResourceChanges(planJson);
  assert.deepEqual(changes.map(change => change.action), ['replace', 'update', 'no-op']);

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const replacementNode = impactedGraph.nodes.find(node => node.id === 'terraform-resource:aws_instance.api');

  assert.ok(replacementNode);
  assert.equal(replacementNode.kind, 'terraform-resource');
  assert.equal(replacementNode.source, 'terraform-plan');
  assert.equal(replacementNode.metadata?.action, 'replace');
  assert.equal(replacementNode.metadata?.replacePaths, 'ami,tags.Name');
  assert.equal(replacementNode.metadata?.replacementReasonCategories, 'provider-reported');
  assert.match(String(replacementNode.metadata?.replacementReasons), /Provider reported replacement for aws_instance\.ami/);
  assert.equal(impactedGraph.summary.changesByAction?.replace, 1);
  assert.equal(impactedGraph.summary.changesByAction?.update, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.ok(impactedGraph.edges.some(edge =>
    edge.kind === 'planned-change'
    && edge.from === 'terraform-root:terraform/payments-api'
    && edge.to === 'terraform-resource:aws_instance.api'
  ));
});

test('Terraform plan impact marks matching delete and create resources as possible renames', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_s3_bucket.old_name',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'old_name',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete'],
          before: {
            bucket: 'payments-artifacts',
            tags: {
              Name: 'payments-artifacts'
            }
          }
        }
      },
      {
        address: 'aws_s3_bucket.new_name',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'new_name',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create'],
          after: {
            bucket: 'payments-artifacts',
            tags: {
              Name: 'payments-artifacts'
            }
          }
        }
      },
      {
        address: 'aws_s3_bucket.unrelated',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'unrelated',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create'],
          after: {
            bucket: 'unrelated-artifacts'
          }
        }
      },
      {
        address: 'aws_security_group.old_api',
        mode: 'managed',
        type: 'aws_security_group',
        name: 'old_api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete'],
          before: {
            tags: {
              Name: 'api-shared'
            }
          }
        }
      },
      {
        address: 'aws_security_group.new_api',
        mode: 'managed',
        type: 'aws_security_group',
        name: 'new_api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create'],
          after: {
            tags: {
              Name: 'api-shared'
            }
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const renameEdges = impactedGraph.edges.filter(edge => edge.kind === 'possible-rename');
  const bucketRename = renameEdges.find(edge => edge.from === 'terraform-resource:aws_s3_bucket.old_name');
  const tagOnlyRename = renameEdges.find(edge => edge.from === 'terraform-resource:aws_security_group.old_api');

  assert.equal(renameEdges.length, 2);
  assert.equal(bucketRename?.to, 'terraform-resource:aws_s3_bucket.new_name');
  assert.equal(bucketRename?.confidence, 'high');
  assert.equal(bucketRename?.metadata?.matchingIdentityKeys, 'bucket,tags.Name');
  assert.equal(bucketRename?.metadata?.score, 0.95);
  assert.match(String(bucketRename?.metadata?.reason), /same resource type; same provider/);
  assert.equal(tagOnlyRename?.to, 'terraform-resource:aws_security_group.new_api');
  assert.equal(tagOnlyRename?.confidence, 'medium');
  assert.equal(tagOnlyRename?.metadata?.matchingIdentityKeys, 'tags.Name');
});

test('Terraform plan impact marks exclusive identity create-before-destroy conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_s3_bucket.artifacts',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'artifacts',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['force_destroy']],
          before: {
            bucket: 'payments-artifacts'
          },
          after: {
            bucket: 'payments-artifacts',
            force_destroy: true
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.from, 'terraform-resource:aws_s3_bucket.artifacts');
  assert.equal(conflictEdges[0]?.to, 'terraform-resource:aws_s3_bucket.artifacts');
  assert.equal(conflictEdges[0]?.confidence, 'high');
  assert.equal(conflictEdges[0]?.metadata?.actionOrder, 'create,delete');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-s3-bucket');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'bucket=payments-artifacts');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /create-before-destroy replacement can fail with BucketAlreadyExists/i);
  assert.equal(impactedGraph.summary.impact?.createBeforeDeleteConflicts, 1);
  assert.equal(impactedGraph.summary.impact?.mutationAllowed, false);
  assert.equal(impactedGraph.summary.impact?.omittedReviewTargets, 0);
  assert.equal(impactedGraph.summary.impact?.riskLevel, 'high');
  assert.equal(impactedGraph.summary.impact?.primaryConcern, 'create-before-delete-conflicts');
  assert.equal(impactedGraph.summary.impact?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.ok(impactedGraph.summary.impact?.reviewSteps.some(step => step.includes('delete/create pair')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.kind, 'create-before-delete-conflict');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.riskCategory, 'physical-name-ownership');
  assert.ok(impactedGraph.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('logical rename')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.identity, 'bucket=payments-artifacts');
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('risk=high, primary concern=create-before-delete-conflicts, recommended action=review-create-before-delete-conflicts, mutation allowed=false, review targets=1, omitted review targets=0')
  ));
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('review step: For logical renames, review Terraform moved blocks/state moves or Pulumi aliases/imports')
  ));
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('create-before-delete conflict: aws_s3_bucket.artifacts -> aws_s3_bucket.artifacts [high]')
  ));
});

test('Terraform plan impact marks AWS listener rule priority conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_lb_listener_rule.payments',
        mode: 'managed',
        type: 'aws_lb_listener_rule',
        name: 'payments',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['condition']],
          before: {
            listener_arn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 100
          },
          after: {
            listener_arn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 100
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.confidence, 'high');
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-lb-listener-rule');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'listenerArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2,priority=100'
  );
  assert.match(String(conflictEdge.metadata?.reason), /PriorityInUse/);
});

test('Terraform plan impact marks AWS security group rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_security_group_rule.api_https',
        mode: 'managed',
        type: 'aws_security_group_rule',
        name: 'api_https',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_blocks: ['10.0.0.0/16'],
            ipv6_cidr_blocks: ['2001:db8::/48']
          },
          after: {
            security_group_id: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_blocks: ['10.1.0.0/16'],
            ipv6_cidr_blocks: ['2001:db8::/48']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-security-group-rule');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,type,protocol,fromPort,toPort,source');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,type=ingress,protocol=tcp,fromPort=443,toPort=443,source=10.0.0.0/16|2001:db8::/48'
  );
  assert.match(String(conflictEdge.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Terraform plan impact marks AWS VPC security group ingress rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_vpc_security_group_ingress_rule.api_https',
        mode: 'managed',
        type: 'aws_vpc_security_group_ingress_rule',
        name: 'api_https',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_ipv4: '10.0.0.0/16'
          },
          after: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            from_port: 443,
            to_port: 443,
            cidr_ipv4: '10.0.0.0/16',
            description: 'managed https ingress'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,ipProtocol,fromPort,toPort,peer');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=tcp,fromPort=443,toPort=443,peer=10.0.0.0/16'
  );
  assert.match(String(conflictEdge.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Terraform plan impact marks all-protocol VPC security group rules without ports', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_vpc_security_group_egress_rule.all_outbound',
        mode: 'managed',
        type: 'aws_vpc_security_group_egress_rule',
        name: 'all_outbound',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            ip_protocol: '-1',
            cidr_ipv4: '0.0.0.0/0'
          },
          after: {
            security_group_id: 'sg-1234567890',
            ip_protocol: '-1',
            cidr_ipv4: '0.0.0.0/0',
            description: 'managed all outbound'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,ipProtocol,peer');
  assert.equal(
    conflictEdge.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=-1,peer=0.0.0.0/0'
  );
});

test('Terraform plan impact keeps VPC security group TCP rules without ports incomplete', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_vpc_security_group_ingress_rule.incomplete_https',
        mode: 'managed',
        type: 'aws_vpc_security_group_ingress_rule',
        name: 'incomplete_https',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['description']],
          before: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            cidr_ipv4: '10.0.0.0/16'
          },
          after: {
            security_group_id: 'sg-1234567890',
            ip_protocol: 'tcp',
            cidr_ipv4: '10.0.0.0/16',
            description: 'missing ports should stay conservative'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 0);
});

test('Terraform plan impact marks CloudFront alias overlap conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_cloudfront_distribution.edge',
        mode: 'managed',
        type: 'aws_cloudfront_distribution',
        name: 'edge',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['viewer_certificate']],
          before: {
            aliases: ['api.example.com', 'old.example.com']
          },
          after: {
            aliases: ['api.example.com', 'new.example.com']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.confidence, 'high');
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-cloudfront-alias');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'aliases');
  assert.equal(conflictEdge.metadata?.exclusiveIdentityValues, 'aliases=api.example.com|old.example.com');
  assert.match(String(conflictEdge.metadata?.reason), /CNAMEAlreadyExists/);
});

test('Terraform plan impact marks Route53 ACM validation record conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_route53_record.acm_validation',
        mode: 'managed',
        type: 'aws_route53_record',
        name: 'acm_validation',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['records']],
          before: {
            zone_id: 'Z1234567890',
            name: '_abc.api.example.com',
            type: 'CNAME',
            records: ['_old.acm-validations.aws.']
          },
          after: {
            zone_id: 'Z1234567890',
            name: '_abc.api.example.com',
            type: 'CNAME',
            records: ['_new.acm-validations.aws.']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-route53-record');
  assert.equal(conflictEdge.metadata?.matchingExclusiveIdentityKeys, 'zoneId,name,type');
  assert.equal(conflictEdge.metadata?.exclusiveIdentityValues, 'zoneId=Z1234567890,name=_abc.api.example.com,type=CNAME');
  assert.match(String(conflictEdge.metadata?.reason), /InvalidChangeBatch/);
  assert.match(String(conflictEdge.metadata?.suggestedAction), /ACM validation CNAMEs/);
});

test('Terraform plan impact marks IAM OIDC provider URL conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_iam_openid_connect_provider.github',
        mode: 'managed',
        type: 'aws_iam_openid_connect_provider',
        name: 'github',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['thumbprint_list']],
          before: {
            url: 'https://token.actions.githubusercontent.com',
            client_id_list: ['sts.amazonaws.com'],
            thumbprint_list: ['oldthumbprint']
          },
          after: {
            url: 'https://token.actions.githubusercontent.com',
            client_id_list: ['sts.amazonaws.com'],
            thumbprint_list: ['newthumbprint']
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const conflictEdge = impactedGraph.edges.find(edge => edge.kind === 'create-before-delete-conflict');

  assert.ok(conflictEdge);
  assert.equal(conflictEdge.metadata?.exclusiveIdentitySpec, 'aws-iam-oidc-provider');
  assert.equal(conflictEdge.metadata?.exclusiveIdentityValues, 'url=https://token.actions.githubusercontent.com');
  assert.match(String(conflictEdge.metadata?.reason), /EntityAlreadyExists/);
});

test('Terraform plan impact enriches replacement reasons from known replacement paths', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    resource_changes: [
      {
        address: 'aws_s3_bucket.artifacts',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'artifacts',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['bucket']],
          before: {
            bucket: 'payments-artifacts'
          },
          after: {
            bucket: 'payments-artifacts-v2'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const bucketNode = impactedGraph.nodes.find(node => node.id === 'terraform-resource:aws_s3_bucket.artifacts');

  assert.ok(bucketNode);
  assert.equal(bucketNode.metadata?.replacementReasonCategories, 'exclusive-identity');
  assert.equal(bucketNode.metadata?.replacementReasonPaths, 'bucket');
  assert.match(String(bucketNode.metadata?.replacementReasons), /AWS S3 Bucket: bucket is the globally unique physical bucket name/);
  assert.match(String(bucketNode.metadata?.replacementSuggestedActions), /bucket identity change/);
});

test('Terraform plan impact marks dependency edges and replacement cascades', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    planned_values: {
      root_module: {
        resources: [
          {
            address: 'aws_s3_bucket.artifacts',
            depends_on: []
          },
          {
            address: 'aws_lambda_function.api',
            depends_on: ['aws_s3_bucket.artifacts']
          }
        ]
      }
    },
    resource_changes: [
      {
        address: 'aws_s3_bucket.artifacts',
        mode: 'managed',
        type: 'aws_s3_bucket',
        name: 'artifacts',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['bucket']],
          before: {
            bucket: 'payments-artifacts'
          },
          after: {
            bucket: 'payments-artifacts-v2'
          }
        }
      },
      {
        address: 'aws_lambda_function.api',
        mode: 'managed',
        type: 'aws_lambda_function',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['delete', 'create'],
          replace_paths: [['source_code_hash']],
          before: {
            function_name: 'payments-api'
          },
          after: {
            function_name: 'payments-api'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === 'terraform-resource:aws_lambda_function.api'
    && edge.to === 'terraform-resource:aws_s3_bucket.artifacts'
  );
  const cascadeEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'replacement-cascade'
    && edge.from === 'terraform-resource:aws_s3_bucket.artifacts'
    && edge.to === 'terraform-resource:aws_lambda_function.api'
  );

  assert.ok(dependencyEdge);
  assert.equal(dependencyEdge.source, 'terraform-plan');
  assert.equal(dependencyEdge.metadata?.dependentAction, 'replace');
  assert.ok(cascadeEdge);
  assert.equal(cascadeEdge.source, 'terraform-plan');
  assert.equal(cascadeEdge.confidence, 'high');
  assert.equal(cascadeEdge.metadata?.dependencyAction, 'replace');
  assert.equal(cascadeEdge.metadata?.dependentAction, 'replace');
  assert.equal(cascadeEdge.metadata?.dependencyReplacementReasonCategories, 'exclusive-identity');
  assert.match(String(cascadeEdge.metadata?.dependencyReplacementReasons), /bucket: AWS S3 Bucket/);
  assert.equal(impactedGraph.summary.edgesByKind['depends-on'], 1);
  assert.equal(impactedGraph.summary.impact?.replacementCascades, 1);
  assert.equal(impactedGraph.summary.impact?.mutationAllowed, false);
  assert.equal(impactedGraph.summary.impact?.omittedReviewTargets, 0);
  assert.equal(impactedGraph.summary.impact?.riskLevel, 'medium');
  assert.equal(impactedGraph.summary.impact?.primaryConcern, 'replacement-cascades');
  assert.equal(impactedGraph.summary.impact?.recommendedAction, 'review-replacement-cascades');
  assert.ok(impactedGraph.summary.impact?.reviewSteps.some(step => step.includes('downstream blast radius')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.kind, 'replacement-cascade');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-replacement-cascades');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.riskCategory, 'replacement-cascade-review');
  assert.ok(impactedGraph.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('blast radius')));
  assert.match(String(impactedGraph.summary.impact?.reviewTargets[0]?.replacementReasons), /bucket: AWS S3 Bucket/);
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('replacement cascade: aws_s3_bucket.artifacts -> aws_lambda_function.api [high] replace -> replace')
  ));
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('reason=bucket: AWS S3 Bucket')
  ));
});

test('Terraform plan impact adds unchanged dependency context nodes', async () => {
  const inspection = await inspectWorkspace('fixtures/terraform-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const planJson = {
    planned_values: {
      root_module: {
        resources: [
          {
            address: 'aws_s3_bucket.artifacts',
            mode: 'managed',
            type: 'aws_s3_bucket',
            name: 'artifacts',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            values: {
              bucket: 'payments-artifacts'
            }
          },
          {
            address: 'aws_lambda_function.api',
            mode: 'managed',
            type: 'aws_lambda_function',
            name: 'api',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            depends_on: ['aws_s3_bucket.artifacts'],
            values: {
              function_name: 'payments-api'
            }
          }
        ]
      }
    },
    resource_changes: [
      {
        address: 'aws_lambda_function.api',
        mode: 'managed',
        type: 'aws_lambda_function',
        name: 'api',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['update'],
          after: {
            function_name: 'payments-api'
          }
        }
      }
    ]
  };

  const impactedGraph = attachTerraformPlanToGraph(graph, planJson, {
    targetPath: 'terraform/payments-api'
  });
  const contextNode = impactedGraph.nodes.find(node => node.id === 'terraform-resource:aws_s3_bucket.artifacts');
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === 'terraform-resource:aws_lambda_function.api'
    && edge.to === 'terraform-resource:aws_s3_bucket.artifacts'
  );

  assert.ok(contextNode);
  assert.equal(contextNode.source, 'terraform-plan');
  assert.equal(contextNode.metadata?.role, 'dependency-context');
  assert.equal(contextNode.metadata?.action, undefined);
  assert.equal(contextNode.metadata?.exclusiveIdentitySpec, 'aws-s3-bucket');
  assert.equal(contextNode.metadata?.exclusiveIdentityKeys, 'bucket');
  assert.ok(dependencyEdge);
  assert.equal(impactedGraph.summary.changesByAction?.update, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.equal(impactedGraph.summary.impact?.plannedChanges, 1);
  assert.equal(impactedGraph.summary.impact?.dependencyEdges, 1);
});
