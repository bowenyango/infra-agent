import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  cp,
  readFile,
  rm
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  resolve,
  join
} from 'node:path';
import { inspectWorkspace } from '../../src/domain/inspect-workspace.ts';
import { runSingleStep } from '../../src/agent/run-single-step.ts';
import { executeDecision } from '../../src/agent/execute-decision.ts';
import {
  buildTargetCandidates,
  detectRequestedService
} from '../../src/domain/task-targeting.ts';
import { buildRunPreflight } from '../../src/agent/build-run-preflight.ts';
import { buildValidationPreflight } from '../../src/validators/preflight.ts';
import { classifyValidationIssues } from '../../src/agent/classify-validation-issues.ts';
import { RuleBasedPlanningModel } from '../../src/agent/rule-based-planner.ts';
import { buildEditPlan } from '../../src/agent/build-edit-plan.ts';
import { main } from '../../src/cli/main.ts';

test('inspect-target-files reads Terraform root files into runtime observations', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Terraform files.',
        rationale: 'Test Terraform inspection path.',
        payload: {
          targetPaths: ['terraform/payments-api'],
          requestedDomains: ['terraform']
        }
      }
    },
    resolve('fixtures/terraform-workspace'),
    null
  );

  assert.ok(execution);
  const readPaths = execution?.executedTools
    .filter(result => result.toolName === 'read_file')
    .map(result => result.output.path);

  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/main.tf')));
  assert.ok(readPaths?.some(path => path.endsWith('terraform/payments-api/dev.auto.tfvars')));
  assert.ok(readPaths?.every(path => !path.endsWith('Chart.yaml')));
});

test('inspect-target-files uses helm_show_values for Helm chart inspection', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Helm files.',
        rationale: 'Test Helm inspection path.',
        payload: {
          targetPaths: ['charts/payments-api'],
          requestedDomains: ['helm']
        }
      }
    },
    resolve('fixtures/sample-workspace'),
    null
  );

  assert.ok(execution);
  const helmShowValues = execution?.executedTools.find(result => result.toolName === 'helm_show_values');

  assert.ok(helmShowValues);
  assert.match(helmShowValues?.output.command ?? '', /helm show values charts\/payments-api/i);
  assert.match(helmShowValues?.output.content ?? '', /service:\s*\n\s*port:\s*8080/i);
});

test('inspect-target-files uses helm_show_chart for Helm chart metadata inspection', async () => {
  const execution = await executeDecision(
    {
      confidence: 'high',
      action: {
        kind: 'inspect-target-files',
        summary: 'Inspect Helm files.',
        rationale: 'Test Helm chart metadata path.',
        payload: {
          targetPaths: ['charts/payments-api'],
          requestedDomains: ['helm']
        }
      }
    },
    resolve('fixtures/sample-workspace'),
    null
  );

  assert.ok(execution);
  const helmShowChart = execution?.executedTools.find(result => result.toolName === 'helm_show_chart');

  assert.ok(helmShowChart);
  assert.match(helmShowChart?.output.command ?? '', /helm show chart charts\/payments-api/i);
  assert.match(helmShowChart?.output.content ?? '', /name:\s*payments-api/i);
  assert.match(helmShowChart?.output.content ?? '', /version:\s*0.1.0/i);
});

test('classifyValidationIssues marks terraform fmt failures as terraform-formatting-required', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api fmt -check -recursive',
      exitCode: 3,
      stdout: 'main.tf',
      stderr: ''
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-formatting-required');
  assert.equal(issues[0]?.repairable, true);
});

test('classifyValidationIssues marks terraform validate failures as terraform-validate-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Reference to undeclared input variable'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.message ?? '', /undeclared input variable/i);
  assert.match(issues[0]?.guidance ?? '', /variable name exists in variable declarations and tfvars/i);
});

test('classifyValidationIssues provides actionable guidance for missing required Terraform arguments', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/payments-api validate',
      exitCode: 1,
      stdout: '',
      stderr: 'Error: Missing required argument\n\nThe argument "image_tag" is required, but no definition was found.'
    }
  ]);

  assert.equal(issues[0]?.kind, 'terraform-validate-failure');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingVariableName, 'image_tag');
  assert.match(issues[0]?.guidance ?? '', /add the missing required argument through an existing tfvars file or declared variable path/i);
});

test('classifyValidationIssues marks Terraform AWS route identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/network apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating Route in Route Table (rtb-0102177ec9e1ab465): operation error EC2: CreateRoute, https response error StatusCode: 400, api error RouteAlreadyExists: Route in Route Table (rtb-0102177ec9e1ab465) with destination (10.0.0.0/16) already exists',
        '',
        '  with module.network.aws_route.private[0],',
        '  on routes.tf line 12, in resource "aws_route" "private":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.conflictCode, 'RouteAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-route');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_route');
  assert.equal(issues[0]?.metadata?.resourceAddress, 'module.network.aws_route.private[0]');
  assert.equal(issues[0]?.metadata?.routeTableIds, 'rtb-0102177ec9e1ab465');
  assert.equal(issues[0]?.metadata?.routeDestinations, '10.0.0.0/16');
  assert.match(issues[0]?.guidance ?? '', /Terraform attempted to create/i);
  assert.match(issues[0]?.guidance ?? '', /moved blocks/i);
  assert.match(issues[0]?.guidance ?? '', /create_before_destroy/i);
});

test('classifyValidationIssues marks Terraform listener rule priority conflicts', () => {
  const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/api/50dc6c495c0c9188/f2f7dc8efc522ab2';
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/edge plan',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating ELBv2 Listener Rule: operation error Elastic Load Balancing v2: CreateRule, https response error StatusCode: 400, api error PriorityInUse: Priority \'100\' is currently in use on listener ' + listenerArn,
        '',
        '  with aws_lb_listener_rule.api,',
        '  on listeners.tf line 31, in resource "aws_lb_listener_rule" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'PriorityInUse');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_lb_listener_rule');
  assert.equal(issues[0]?.metadata?.listenerArns, listenerArn);
  assert.equal(issues[0]?.metadata?.listenerRulePriorities, '100');
  assert.match(issues[0]?.guidance ?? '', /listenerArn and priority/);
  assert.match(issues[0]?.guidance ?? '', /choose a free priority/);
});

test('classifyValidationIssues uses shared specs for Terraform bucket identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/storage apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating S3 Bucket (prod-artifacts): operation error S3: CreateBucket, https response error StatusCode: 409, api error BucketAlreadyOwnedByYou: Your previous request to create the named bucket succeeded and you already own it.',
        '',
        '  with aws_s3_bucket.artifacts,',
        '  on buckets.tf line 3, in resource "aws_s3_bucket" "artifacts":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'BucketAlreadyOwnedByYou');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-s3-bucket');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS S3 Bucket');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_s3_bucket');
  assert.match(issues[0]?.metadata?.conflictSuggestedAction ?? '', /physical bucket/i);
  assert.match(issues[0]?.guidance ?? '', /AWS S3 Bucket/);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
  assert.match(issues[0]?.guidance ?? '', /moved blocks/);
});

test('classifyValidationIssues extracts Terraform AWS named resource identities', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/services apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: creating ECR Repository (payments-api): operation error ECR: CreateRepository, https response error StatusCode: 400, api error RepositoryAlreadyExistsException: The repository with name \'payments-api\' already exists in the registry with id \'123456789012\'',
        '',
        '  with aws_ecr_repository.api,',
        '  on ecr.tf line 2, in resource "aws_ecr_repository" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'RepositoryAlreadyExistsException');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-named-resource');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS named resource');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws_ecr_repository');
  assert.equal(issues[0]?.metadata?.resourceAddress, 'aws_ecr_repository.api');
  assert.equal(issues[0]?.metadata?.duplicateIdentity, 'payments-api');
  assert.match(issues[0]?.guidance ?? '', /AWS named resource/);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
});

test('classifyValidationIssues extracts Terraform Kubernetes object identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'terraform -chdir=terraform/apps apply -auto-approve',
      exitCode: 1,
      stdout: '',
      stderr: [
        'Error: services "payments-api" already exists',
        '',
        '  with kubernetes_service.api,',
        '  on service.tf line 4, in resource "kubernetes_service" "api":'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'terraform-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'AlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'kubernetes-namespaced-object');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'Kubernetes namespaced object');
  assert.equal(issues[0]?.metadata?.resourceType, 'kubernetes_service');
  assert.equal(issues[0]?.metadata?.kubernetesNames, 'payments-api');
  assert.match(issues[0]?.guidance ?? '', /metadata\.name, and metadata\.namespace/);
  assert.match(issues[0]?.guidance ?? '', /Kubernetes object named payments-api/);
});

test('classifyValidationIssues marks missing Pulumi config as pulumi-missing-config', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: missing required configuration variable "payments-api:imageTag"; run `pulumi config set payments-api:imageTag <value>`'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-missing-config');
  assert.equal(issues[0]?.repairable, true);
  assert.equal(issues[0]?.metadata?.missingConfigKey, 'payments-api:imageTag');
  assert.match(issues[0]?.guidance ?? '', /set payments-api:imageTag/i);
});

test('classifyValidationIssues marks Pulumi AWS route create-before-delete conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/networking --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:ec2:Route (scrawlr-prod-subnet-0cce76f6ee720890b-pcx-0881f5cc374f72a09):',
        'error: api error RouteAlreadyExists: Route in Route Table (rtb-0102177ec9e1ab465) with destination (10.0.0.0/16) already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.routeTableIds, 'rtb-0102177ec9e1ab465');
  assert.equal(issues[0]?.metadata?.routeDestinations, '10.0.0.0/16');
  assert.equal(issues[0]?.metadata?.providerName, 'aws@7.23.0');
  assert.equal(issues[0]?.metadata?.conflictCode, 'RouteAlreadyExists');
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/i);
  assert.match(issues[0]?.guidance ?? '', /aliases/i);
});

test('classifyValidationIssues marks generic Pulumi already-exists conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/storage --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:s3:Bucket (prod-artifacts):',
        'error: api error BucketAlreadyExists: The requested bucket name is not available: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.repairable, false);
  assert.equal(issues[0]?.metadata?.conflictCode, 'BucketAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-s3-bucket');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS S3 Bucket');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws:s3:Bucket');
  assert.match(issues[0]?.guidance ?? '', /same provider identity/i);
  assert.match(issues[0]?.guidance ?? '', /Provider rule:/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/i);
});

test('classifyValidationIssues extracts Pulumi Kubernetes object identity conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/apps --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'kubernetes:core/v1:Service (payments-api):',
        'error: resource default/payments-api was not successfully created by the Kubernetes API server : services "payments-api" already exists'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'AlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'kubernetes-namespaced-object');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'Kubernetes namespaced object');
  assert.equal(issues[0]?.metadata?.resourceType, 'kubernetes:core/v1:Service');
  assert.equal(issues[0]?.metadata?.kubernetesNames, 'payments-api');
  assert.equal(issues[0]?.metadata?.kubernetesNamespaces, 'default');
  assert.match(issues[0]?.guidance ?? '', /namespace\(s\) default/);
  assert.match(issues[0]?.guidance ?? '', /aliases\/import\/state repair/);
});

test('classifyValidationIssues extracts Pulumi AWS named resource identities', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/identity --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:iam/role:Role (api-role):',
        'error: api error EntityAlreadyExists: Role with name prod-api already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'EntityAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-named-resource');
  assert.equal(issues[0]?.metadata?.conflictLabel, 'AWS named resource');
  assert.equal(issues[0]?.metadata?.resourceType, 'aws:iam/role:Role');
  assert.equal(issues[0]?.metadata?.resourceName, 'api-role');
  assert.equal(issues[0]?.metadata?.duplicateIdentity, 'prod-api');
  assert.match(issues[0]?.guidance ?? '', /identity prod-api/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/);
});

test('classifyValidationIssues marks Pulumi CloudFront alias conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/edge --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:cloudfront/distribution:Distribution (edge):',
        'error: api error CNAMEAlreadyExists: The CNAME alias "api.example.com" is already associated with another CloudFront distribution: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'CNAMEAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-cloudfront-alias');
  assert.equal(issues[0]?.metadata?.dnsNames, 'api.example.com');
  assert.match(issues[0]?.guidance ?? '', /CloudFront distribution alias\/CNAME/);
  assert.match(issues[0]?.guidance ?? '', /state moves/);
});

test('classifyValidationIssues marks Pulumi API Gateway custom domain conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/api --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:apigateway/domainName:DomainName (api-domain):',
        'error: api error ConflictException: The domain name api.example.com already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'ConflictException');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-api-gateway-domain-name');
  assert.equal(issues[0]?.metadata?.dnsNames, 'api.example.com');
  assert.match(issues[0]?.guidance ?? '', /API Gateway custom domain/);
  assert.match(issues[0]?.guidance ?? '', /deleteBeforeReplace/);
});

test('classifyValidationIssues marks Pulumi Route53 InvalidChangeBatch conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/dns --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:route53/record:Record (api-validation):',
        'error: 1 error occurred:',
        '  * api error InvalidChangeBatch: [Tried to create resource record set [name="_abc.api.example.com.", type="CNAME"] but it already exists]: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'InvalidChangeBatch');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-route53-record');
  assert.equal(issues[0]?.metadata?.dnsNames, '_abc.api.example.com.');
  assert.equal(issues[0]?.metadata?.recordTypes, 'CNAME');
  assert.match(issues[0]?.guidance ?? '', /ACM validation CNAMEs/);
  assert.match(issues[0]?.guidance ?? '', /allowOverwrite/);
});

test('classifyValidationIssues marks Pulumi security group duplicate permission conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/network --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:vpc/securityGroupIngressRule:SecurityGroupIngressRule (api-https):',
        'error: api error InvalidPermission.Duplicate: the specified rule "peer: 10.0.0.0/16, TCP, from port: 443, to port: 443, ALLOW" already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'InvalidPermission.Duplicate');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-vpc-security-group-rule');
  assert.equal(issues[0]?.metadata?.securityGroupRulePeers, '10.0.0.0/16');
  assert.match(issues[0]?.guidance ?? '', /security group rule/);
  assert.match(issues[0]?.guidance ?? '', /direction, protocol, port range, security group, and peer/);
  assert.match(issues[0]?.guidance ?? '', /inline, legacy, and VPC-style rule managers/);
});

test('classifyValidationIssues marks Pulumi listener rule priority conflicts', () => {
  const listenerArn = 'arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/api/50dc6c495c0c9188/f2f7dc8efc522ab2';
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/edge --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:lb/listenerRule:ListenerRule (api-https):',
        `error: api error PriorityInUse: Priority '100' is currently in use on listener ${listenerArn}: provider=aws@7.23.0`
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'PriorityInUse');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-lb-listener-rule');
  assert.equal(issues[0]?.metadata?.listenerArns, listenerArn);
  assert.equal(issues[0]?.metadata?.listenerRulePriorities, '100');
  assert.match(issues[0]?.guidance ?? '', /load balancer listener rule/);
  assert.match(issues[0]?.guidance ?? '', /listenerArn and priority/);
  assert.match(issues[0]?.guidance ?? '', /choose a free priority/);
});

test('classifyValidationIssues marks Pulumi IAM OIDC provider duplicate conflicts', () => {
  const issues = classifyValidationIssues([
    {
      command: 'pulumi up --cwd infra/identity --stack prod --yes',
      exitCode: 255,
      stdout: '',
      stderr: [
        'aws:iam/openIdConnectProvider:OpenIdConnectProvider (github):',
        'error: api error EntityAlreadyExists: Provider with url https://token.actions.githubusercontent.com already exists: provider=aws@7.23.0'
      ].join('\n')
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-create-before-delete-conflict');
  assert.equal(issues[0]?.metadata?.conflictCode, 'EntityAlreadyExists');
  assert.equal(issues[0]?.metadata?.conflictFamily, 'aws-iam-oidc-provider');
  assert.equal(issues[0]?.metadata?.oidcProviderUrls, 'https://token.actions.githubusercontent.com');
  assert.match(issues[0]?.guidance ?? '', /IAM OIDC provider/);
  assert.match(issues[0]?.guidance ?? '', /role trust policies/);
  assert.match(issues[0]?.guidance ?? '', /import\/state repair or aliases/);
});

test('classifyValidationIssues marks general Pulumi preview failures as pulumi-preview-failure', () => {
  const issues = classifyValidationIssues([
    {
      command: 'PULUMI_BACKEND_URL=file://$PWD/.pulumi-state pulumi preview --cwd infra/payments-api --stack dev --non-interactive',
      exitCode: 1,
      stdout: '',
      stderr: 'error: preview failed because the stack configuration is invalid'
    }
  ]);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.kind, 'pulumi-preview-failure');
  assert.equal(issues[0]?.repairable, false);
  assert.match(issues[0]?.guidance ?? '', /failing Pulumi project and stack file/i);
});

test('executeDecision runs terraform formatting repair inside the selected Terraform root', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-fmt-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const execution = await executeDecision(
      {
        confidence: 'high',
        action: {
          kind: 'repair-terraform-formatting',
          summary: 'Repair Terraform formatting.',
          rationale: 'terraform fmt -check failed.',
          payload: {
            rootPath: 'terraform/payments-api'
          }
        }
      },
      workspaceRoot,
      null
    );

    assert.ok(execution);
    assert.equal(execution?.executedTools[0]?.toolName, 'search_workspace');
    assert.equal(execution?.executedTools[1]?.toolName, 'terraform_fmt');
    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    assert.match(repairedMainTf, /  type = string/);
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('rule-based agent repairs Terraform formatting failures and revalidates', async () => {
  const tempRoot = await mkdtemp(resolve(tmpdir(), 'infra-agent-terraform-repair-'));
  const workspaceRoot = join(tempRoot, 'workspace');

  try {
    await cp(resolve('fixtures/terraform-format-repair-workspace'), workspaceRoot, { recursive: true });
    const result = await runSingleStep(
      'update terraform payments-api dev image tag to 2.3.4',
      workspaceRoot,
      undefined,
      'rule-based'
    );

    assert.ok(result.turns.some(turn => turn.decision.action.kind === 'repair-terraform-formatting'));
    assert.ok(result.turns.some(turn => turn.execution?.executedTools.some(tool => tool.toolName === 'terraform_fmt')));
    assert.ok(result.runtime.repairAttempts >= 1);
    assert.ok(result.runtime.validationResults.every(entry => entry.exitCode === 0));
    assert.equal(result.runtime.validationIssues.length, 0);
    assert.equal(result.outcome, 'completed');

    const repairedMainTf = await readFile(join(workspaceRoot, 'terraform/payments-api/main.tf'), 'utf8');
    const updatedTfvars = await readFile(join(workspaceRoot, 'terraform/payments-api/dev.auto.tfvars'), 'utf8');
    assert.match(repairedMainTf, /  image_tag   = var\.image_tag/);
    assert.match(updatedTfvars, /image_tag\s*=\s*"2.3.4"/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
