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

test('Pulumi preview impact attaches resource change nodes to the infra graph', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'create',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api',
          type: 'kubernetes:apps/v1:Deployment',
          name: 'payments-api',
          diffs: ['spec.template.spec.containers[0].image']
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api',
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api',
          detailedDiff: {
            ingress: {
              kind: 'update'
            }
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'same',
          urn: 'urn:pulumi:dev::payments-api::pulumi:pulumi:Stack::payments-api-dev',
          type: 'pulumi:pulumi:Stack',
          name: 'payments-api-dev'
        }
      }
    }
  ];

  const changes = parsePulumiPreviewResourceChanges(previewJson);
  assert.deepEqual(changes.map(change => change.action), ['create', 'replace', 'no-op']);

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const deploymentNode = impactedGraph.nodes.find(node =>
    node.id === 'pulumi-resource:urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api'
  );

  assert.ok(deploymentNode);
  assert.equal(deploymentNode.kind, 'pulumi-resource');
  assert.equal(deploymentNode.source, 'pulumi-preview');
  assert.equal(deploymentNode.metadata?.action, 'create');
  assert.equal(deploymentNode.metadata?.diffs, 'spec.template.spec.containers[0].image');
  assert.equal(impactedGraph.summary.changesByAction?.create, 1);
  assert.equal(impactedGraph.summary.changesByAction?.replace, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.ok(impactedGraph.edges.some(edge =>
    edge.kind === 'planned-change'
    && edge.source === 'pulumi-preview'
    && edge.from === 'pulumi-project:infra/payments-api'
    && edge.to === deploymentNode.id
  ));
});

test('Pulumi preview impact marks matching delete and create resources as possible renames', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
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
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create',
          urn: 'urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::other-api',
          type: 'kubernetes:core/v1:Service',
          name: 'other-api',
          new: {
            metadata: {
              name: 'other-api',
              namespace: 'default'
            }
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const renameEdges = impactedGraph.edges.filter(edge => edge.kind === 'possible-rename');

  assert.equal(renameEdges.length, 1);
  assert.equal(renameEdges[0]?.from, 'pulumi-resource:urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::old-api');
  assert.equal(renameEdges[0]?.to, 'pulumi-resource:urn:pulumi:dev::payments-api::kubernetes:core/v1:Service::new-api');
  assert.equal(renameEdges[0]?.source, 'pulumi-preview');
  assert.equal(renameEdges[0]?.confidence, 'high');
  assert.equal(renameEdges[0]?.metadata?.matchingIdentityKeys, 'metadata.name,metadata.namespace');
  assert.equal(renameEdges[0]?.metadata?.score, 1);
});

test('Pulumi preview impact enriches replacement reasons from detailed diff', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const bucketUrn = 'urn:pulumi:dev::payments-api::aws:s3/bucket:Bucket::artifacts';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: bucketUrn,
          type: 'aws:s3/bucket:Bucket',
          name: 'artifacts',
          detailedDiff: {
            bucket: {
              kind: 'update-replace'
            },
            tags: {
              kind: 'update'
            }
          },
          old: {
            bucket: 'payments-artifacts'
          },
          new: {
            bucket: 'payments-artifacts-v2'
          }
        }
      }
    }
  ];

  const changes = parsePulumiPreviewResourceChanges(previewJson);
  assert.deepEqual(changes[0]?.replacementPaths, ['bucket']);

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const bucketNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${bucketUrn}`);

  assert.ok(bucketNode);
  assert.equal(bucketNode.metadata?.replacementPaths, 'bucket');
  assert.equal(bucketNode.metadata?.replacementReasonCategories, 'exclusive-identity');
  assert.match(String(bucketNode.metadata?.replacementReasons), /AWS S3 Bucket: bucket is the globally unique physical bucket name/);
  assert.match(String(bucketNode.metadata?.replacementSuggestedActions), /bucket identity change/);
});

test('Pulumi preview impact enriches AWS listener rule priority replacement reasons', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const ruleUrn = 'urn:pulumi:dev::payments-api::aws:lb/listenerRule:ListenerRule::payments';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: ruleUrn,
          type: 'aws:lb/listenerRule:ListenerRule',
          name: 'payments',
          detailedDiff: {
            priority: {
              kind: 'update-replace'
            }
          },
          old: {
            listenerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 100
          },
          new: {
            listenerArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2',
            priority: 200
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const ruleNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${ruleUrn}`);

  assert.ok(ruleNode);
  assert.equal(ruleNode.metadata?.replacementPaths, 'priority');
  assert.equal(ruleNode.metadata?.replacementReasonCategories, 'exclusive-identity');
  assert.match(String(ruleNode.metadata?.replacementReasons), /AWS Load Balancer Listener Rule: priority must be unique/);
  assert.match(String(ruleNode.metadata?.replacementSuggestedActions), /PriorityInUse/);
});

test('Pulumi preview impact enriches ACM certificate domain replacement reasons', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const certificateUrn = 'urn:pulumi:dev::payments-api::aws:acm/certificate:Certificate::api';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: certificateUrn,
          type: 'aws:acm/certificate:Certificate',
          name: 'api',
          detailedDiff: {
            domainName: {
              kind: 'update-replace'
            },
            subjectAlternativeNames: {
              kind: 'update-replace'
            }
          },
          old: {
            domainName: 'api.example.com',
            subjectAlternativeNames: ['www.example.com']
          },
          new: {
            domainName: 'payments.example.com',
            subjectAlternativeNames: ['api.example.com']
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const certificateNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${certificateUrn}`);

  assert.ok(certificateNode);
  assert.equal(certificateNode.metadata?.replacementPaths, 'domainName,subjectAlternativeNames');
  assert.equal(certificateNode.metadata?.replacementReasonCategories, 'resource-address');
  assert.match(String(certificateNode.metadata?.replacementReasons), /AWS ACM Certificate: domain name defines the requested certificate identity/);
  assert.match(String(certificateNode.metadata?.replacementSuggestedActions), /DNS validation records/);
});

test('Pulumi preview impact marks AWS route create-before-delete replacement conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::networking::aws:ec2/route:Route::old-peer-route',
          type: 'aws:ec2/route:Route',
          name: 'old-peer-route',
          old: {
            routeTableId: 'rtb-0102177ec9e1ab465',
            destinationCidrBlock: '10.0.0.0/16',
            vpcPeeringConnectionId: 'pcx-01d08d08a5b09dc56'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::networking::aws:ec2/route:Route::new-peer-route',
          type: 'aws:ec2/route:Route',
          name: 'new-peer-route',
          new: {
            routeTableId: 'rtb-0102177ec9e1ab465',
            destinationCidrBlock: '10.0.0.0/16',
            vpcPeeringConnectionId: 'pcx-0881f5cc374f72a09'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.from, 'pulumi-resource:urn:pulumi:prod::networking::aws:ec2/route:Route::old-peer-route');
  assert.equal(conflictEdges[0]?.to, 'pulumi-resource:urn:pulumi:prod::networking::aws:ec2/route:Route::new-peer-route');
  assert.equal(conflictEdges[0]?.confidence, 'high');
  assert.equal(conflictEdges[0]?.metadata?.routeTableId, 'rtb-0102177ec9e1ab465');
  assert.equal(conflictEdges[0]?.metadata?.destinationValue, '10.0.0.0/16');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /RouteAlreadyExists/i);
  assert.equal(impactedGraph.summary.impact?.createBeforeDeleteConflicts, 1);
  assert.equal(impactedGraph.summary.impact?.mutationAllowed, false);
  assert.ok(impactedGraph.summary.impact?.reviewSteps.some(step => step.includes('manual sequencing')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.kind, 'create-before-delete-conflict');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.priority, 1);
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.recommendedAction, 'review-create-before-delete-conflicts');
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.riskCategory, 'create-before-delete-ordering');
  assert.ok(impactedGraph.summary.impact?.reviewTargets[0]?.reviewSteps.some(step => step.includes('delete-before-create')));
  assert.equal(impactedGraph.summary.impact?.reviewTargets[0]?.identity, 'routeTableId=rtb-0102177ec9e1ab465,destination=10.0.0.0/16');
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('create-before-delete conflict: pulumi:aws:ec2/route:Route::old-peer-route -> pulumi:aws:ec2/route:Route::new-peer-route [high]')
  ));
});

test('Pulumi preview impact marks generic exclusive identity create-before-delete conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::storage::aws:s3/bucket:Bucket::old-artifacts',
          type: 'aws:s3/bucket:Bucket',
          name: 'old-artifacts',
          old: {
            bucket: 'scrawlr-prod-artifacts'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::storage::aws:s3/bucket:Bucket::new-artifacts',
          type: 'aws:s3/bucket:Bucket',
          name: 'new-artifacts',
          new: {
            bucket: 'scrawlr-prod-artifacts'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-s3-bucket');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'bucket=scrawlr-prod-artifacts');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /BucketAlreadyExists/i);
});

test('Pulumi preview impact marks AWS security group rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::network::aws:ec2/securityGroupRule:SecurityGroupRule::old-api-https',
          type: 'aws:ec2/securityGroupRule:SecurityGroupRule',
          name: 'old-api-https',
          old: {
            securityGroupId: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ['10.0.0.0/16']
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::network::aws:ec2/securityGroupRule:SecurityGroupRule::new-api-https',
          type: 'aws:ec2/securityGroupRule:SecurityGroupRule',
          name: 'new-api-https',
          new: {
            securityGroupId: 'sg-1234567890',
            type: 'ingress',
            protocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            cidrBlocks: ['10.0.0.0/16']
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-security-group-rule');
  assert.equal(
    conflictEdges[0]?.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,type=ingress,protocol=tcp,fromPort=443,toPort=443,source=10.0.0.0/16'
  );
  assert.match(String(conflictEdges[0]?.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Pulumi preview impact marks AWS VPC security group egress rule duplicate permission conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::old-api-egress',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'old-api-egress',
          old: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            referencedSecurityGroupId: 'sg-0987654321'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::new-api-egress',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'new-api-egress',
          new: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: 'tcp',
            fromPort: 443,
            toPort: 443,
            referencedSecurityGroupId: 'sg-0987654321'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(
    conflictEdges[0]?.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=tcp,fromPort=443,toPort=443,peer=sg-0987654321'
  );
  assert.match(String(conflictEdges[0]?.metadata?.reason), /InvalidPermission\.Duplicate/);
});

test('Pulumi preview impact marks all-protocol VPC security group rules without ports', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::old-all-outbound',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'old-all-outbound',
          old: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: '-1',
            cidrIpv4: '0.0.0.0/0'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::network::aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule::new-all-outbound',
          type: 'aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule',
          name: 'new-all-outbound',
          new: {
            securityGroupId: 'sg-1234567890',
            ipProtocol: '-1',
            cidrIpv4: '0.0.0.0/0'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-vpc-security-group-rule');
  assert.equal(conflictEdges[0]?.metadata?.matchingExclusiveIdentityKeys, 'securityGroupId,ipProtocol,peer');
  assert.equal(
    conflictEdges[0]?.metadata?.exclusiveIdentityValues,
    'securityGroupId=sg-1234567890,ipProtocol=-1,peer=0.0.0.0/0'
  );
});

test('Pulumi preview impact marks API Gateway custom domain conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::api::aws:apigateway/domainName:DomainName::old-api',
          type: 'aws:apigateway/domainName:DomainName',
          name: 'old-api',
          old: {
            domainName: 'api.example.com'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::api::aws:apigateway/domainName:DomainName::new-api',
          type: 'aws:apigateway/domainName:DomainName',
          name: 'new-api',
          new: {
            domainName: 'api.example.com'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-api-gateway-domain-name');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'domainName=api.example.com');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /ConflictException/);
});

test('Pulumi preview impact marks IAM OIDC provider URL conflicts', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'delete-replaced',
          urn: 'urn:pulumi:prod::identity::aws:iam/openIdConnectProvider:OpenIdConnectProvider::old-github',
          type: 'aws:iam/openIdConnectProvider:OpenIdConnectProvider',
          name: 'old-github',
          old: {
            url: 'https://token.actions.githubusercontent.com'
          }
        }
      }
    },
    {
      resourcePreEvent: {
        metadata: {
          op: 'create-replacement',
          urn: 'urn:pulumi:prod::identity::aws:iam/openIdConnectProvider:OpenIdConnectProvider::new-github',
          type: 'aws:iam/openIdConnectProvider:OpenIdConnectProvider',
          name: 'new-github',
          new: {
            url: 'https://token.actions.githubusercontent.com'
          }
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const conflictEdges = impactedGraph.edges.filter(edge => edge.kind === 'create-before-delete-conflict');

  assert.equal(conflictEdges.length, 1);
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentitySpec, 'aws-iam-oidc-provider');
  assert.equal(conflictEdges[0]?.metadata?.exclusiveIdentityValues, 'url=https://token.actions.githubusercontent.com');
  assert.match(String(conflictEdges[0]?.metadata?.reason), /EntityAlreadyExists/);
});

test('Pulumi preview impact marks dependency edges and replacement cascades', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const securityGroupUrn = 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api';
  const deploymentUrn = 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'replace',
          urn: securityGroupUrn,
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api'
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
          dependencies: [securityGroupUrn]
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === `pulumi-resource:${deploymentUrn}`
    && edge.to === `pulumi-resource:${securityGroupUrn}`
  );
  const cascadeEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'replacement-cascade'
    && edge.from === `pulumi-resource:${securityGroupUrn}`
    && edge.to === `pulumi-resource:${deploymentUrn}`
  );

  assert.ok(dependencyEdge);
  assert.equal(dependencyEdge.source, 'pulumi-preview');
  assert.equal(dependencyEdge.metadata?.dependentAction, 'update');
  assert.ok(cascadeEdge);
  assert.equal(cascadeEdge.source, 'pulumi-preview');
  assert.equal(cascadeEdge.confidence, 'medium');
  assert.equal(cascadeEdge.metadata?.dependencyAction, 'replace');
  assert.equal(cascadeEdge.metadata?.dependentAction, 'update');
  assert.equal(impactedGraph.summary.edgesByKind['depends-on'], 1);
  assert.equal(impactedGraph.summary.impact?.replacementCascades, 1);
  assert.ok(summarizeInfraGraphImpact(impactedGraph).some(line =>
    line.includes('replacement cascade: pulumi:aws:ec2/securityGroup:SecurityGroup::api -> pulumi:kubernetes:apps/v1:Deployment::payments-api [medium] replace -> update')
  ));
});

test('Pulumi preview impact adds unchanged dependency context nodes', async () => {
  const inspection = await inspectWorkspace('fixtures/sample-workspace');
  const graph = buildWorkspaceInfraGraph(inspection);
  const securityGroupUrn = 'urn:pulumi:dev::payments-api::aws:ec2/securityGroup:SecurityGroup::api';
  const deploymentUrn = 'urn:pulumi:dev::payments-api::kubernetes:apps/v1:Deployment::payments-api';
  const previewJson = [
    {
      resourcePreEvent: {
        metadata: {
          op: 'same',
          urn: securityGroupUrn,
          type: 'aws:ec2/securityGroup:SecurityGroup',
          name: 'api'
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
          dependencies: [securityGroupUrn]
        }
      }
    }
  ];

  const impactedGraph = attachPulumiPreviewToGraph(graph, previewJson, {
    targetPath: 'infra/payments-api'
  });
  const contextNode = impactedGraph.nodes.find(node => node.id === `pulumi-resource:${securityGroupUrn}`);
  const dependencyEdge = impactedGraph.edges.find(edge =>
    edge.kind === 'depends-on'
    && edge.from === `pulumi-resource:${deploymentUrn}`
    && edge.to === `pulumi-resource:${securityGroupUrn}`
  );

  assert.ok(contextNode);
  assert.equal(contextNode.source, 'pulumi-preview');
  assert.equal(contextNode.metadata?.role, 'dependency-context');
  assert.equal(contextNode.metadata?.action, undefined);
  assert.equal(contextNode.metadata?.operation, 'same');
  assert.ok(dependencyEdge);
  assert.equal(impactedGraph.summary.changesByAction?.update, 1);
  assert.equal(impactedGraph.summary.changesByAction?.['no-op'], undefined);
  assert.equal(impactedGraph.summary.impact?.plannedChanges, 1);
  assert.equal(impactedGraph.summary.impact?.dependencyEdges, 1);
});
