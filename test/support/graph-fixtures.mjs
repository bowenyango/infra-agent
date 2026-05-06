import { summarizeInfraGraph } from '../../src/impact/workspace-graph.ts';

export function buildGraphSnapshotBaseGraph() {
  const nodes = [
    {
      id: 'workspace',
      kind: 'workspace',
      label: 'Snapshot Workspace',
      path: null,
      domain: 'workspace',
      confidence: 'high',
      source: 'workspace-inspection',
      metadata: {
        profileId: 'snapshot',
        helmCharts: 0,
        pulumiProjects: 1,
        terraformRoots: 1
      }
    },
    {
      id: 'terraform-root:terraform/payments-api',
      kind: 'terraform-root',
      label: 'terraform/payments-api',
      path: 'terraform/payments-api',
      domain: 'terraform',
      confidence: 'high',
      source: 'workspace-inspection',
      metadata: {
        environmentHints: 'dev',
        moduleHints: 'payments-api',
        tfFileCount: 1,
        tfvarsFileCount: 1
      }
    },
    {
      id: 'pulumi-project:infra/payments-api',
      kind: 'pulumi-project',
      label: 'infra/payments-api',
      path: 'infra/payments-api',
      domain: 'pulumi',
      confidence: 'high',
      source: 'workspace-inspection',
      metadata: {
        environmentHints: 'dev',
        projectFile: 'infra/payments-api/Pulumi.yaml',
        stackCount: 1
      }
    }
  ];
  const edges = [
    {
      id: 'contains:workspace->terraform-root:terraform/payments-api',
      from: 'workspace',
      to: 'terraform-root:terraform/payments-api',
      kind: 'contains',
      confidence: 'high',
      source: 'workspace-inspection',
      label: 'workspace contains Terraform root'
    },
    {
      id: 'contains:workspace->pulumi-project:infra/payments-api',
      from: 'workspace',
      to: 'pulumi-project:infra/payments-api',
      kind: 'contains',
      confidence: 'high',
      source: 'workspace-inspection',
      label: 'workspace contains Pulumi project'
    }
  ];

  return {
    kind: 'infra-agent.infra-graph',
    schemaVersion: 1,
    mutationAllowed: false,
    workspaceRoot: 'fixtures/graph-snapshot-workspace',
    nodes,
    edges,
    summary: summarizeInfraGraph(nodes, edges)
  };
}

export function buildGraphSnapshotTerraformPlan() {
  return {
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
              bucket: 'payments-artifacts-v2'
            }
          },
          {
            address: 'aws_iam_role.lambda',
            mode: 'managed',
            type: 'aws_iam_role',
            name: 'lambda',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            values: {
              name: 'payments-lambda'
            }
          },
          {
            address: 'aws_lambda_function.api',
            mode: 'managed',
            type: 'aws_lambda_function',
            name: 'api',
            provider_name: 'registry.terraform.io/hashicorp/aws',
            depends_on: ['aws_s3_bucket.artifacts', 'aws_iam_role.lambda'],
            values: {
              function_name: 'payments-api'
            }
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
          actions: ['update'],
          after: {
            function_name: 'payments-api'
          }
        }
      },
      {
        address: 'aws_route.peer',
        mode: 'managed',
        type: 'aws_route',
        name: 'peer',
        provider_name: 'registry.terraform.io/hashicorp/aws',
        change: {
          actions: ['create', 'delete'],
          replace_paths: [['vpc_peering_connection_id']],
          before: {
            route_table_id: 'rtb-123',
            destination_cidr_block: '10.0.0.0/16',
            vpc_peering_connection_id: 'pcx-old'
          },
          after: {
            route_table_id: 'rtb-123',
            destination_cidr_block: '10.0.0.0/16',
            vpc_peering_connection_id: 'pcx-new'
          }
        }
      }
    ]
  };
}

export function buildGraphSnapshotPulumiPreview() {
  const securityGroupUrn = 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api';
  const deploymentUrn = 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api';
  const configMapUrn = 'urn:pulumi:dev::payments-api::kubernetes:core/v1:ConfigMap::payments-config';

  return [
    {
      resourcePreEvent: {
        metadata: {
          op: 'same',
          urn: configMapUrn,
          type: 'kubernetes:core/v1:ConfigMap',
          name: 'payments-config'
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: securityGroupUrn,
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api',
          detailedDiff: {
            name: {
              kind: 'update-replace'
            }
          },
          old: {
            name: 'payments-api'
          },
          new: {
            name: 'payments-api-v2'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'update',
          urn: deploymentUrn,
          type: 'kubernetes:apps/v1:Deployment',
          name: 'payments-api',
          dependencies: [securityGroupUrn, configMapUrn]
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::old-api',
          type: 'kubernetes:core/v1:Service',
          name: 'old-api',
          old: {
            metadata: {
              name: 'payments-api',
              namespace: 'default'
            }
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::new-api',
          type: 'kubernetes:core/v1:Service',
          name: 'new-api',
          new: {
            metadata: {
              name: 'payments-api',
              namespace: 'default'
            }
          }
        }
      }
    }
  ];
}
