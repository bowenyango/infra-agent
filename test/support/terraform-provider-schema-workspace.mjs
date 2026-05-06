import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeTerraformProviderSchemaWorkspace(tempRoot) {
  const terraformRoot = join(tempRoot, 'terraform/app');
  await mkdir(join(terraformRoot, '.infra-agent'), { recursive: true });
  await writeFile(
    join(terraformRoot, 'main.tf'),
    [
      'terraform {',
      '  required_providers {',
      '    aws = {',
      '      source = "hashicorp/aws"',
      '    }',
      '  }',
      '}',
      '',
      'resource "aws_lb_listener_rule" "payments" {',
      '  listener_arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:listener/app/app/1/2"',
      '  priority     = 100',
      '',
      '  action {',
      '    type             = "forward"',
      '    target_group_arn = "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/app/1"',
      '  }',
      '',
      '  condition {',
      '    path_pattern {',
      '      values = ["/payments/*"]',
      '    }',
      '  }',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(terraformRoot, '.terraform.lock.hcl'),
    [
      'provider "registry.terraform.io/hashicorp/aws" {',
      '  version     = "5.37.0"',
      '  constraints = "~> 5.0"',
      '  hashes      = []',
      '}',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(
    join(terraformRoot, '.infra-agent/terraform-provider-schema.json'),
    JSON.stringify({
      format_version: '1.0',
      provider_schemas: {
        'registry.terraform.io/hashicorp/aws': {
          resource_schemas: {
            aws_lb_listener_rule: {
              version: 0,
              block: {
                attributes: {
                  arn: {
                    type: 'string',
                    computed: true
                  },
                  listener_arn: {
                    type: 'string',
                    required: true
                  },
                  priority: {
                    type: 'number',
                    optional: true
                  }
                },
                block_types: {
                  action: {
                    nesting_mode: 'list',
                    min_items: 1,
                    max_items: 1,
                    block: {
                      attributes: {
                        type: {
                          type: 'string',
                          required: true
                        }
                      }
                    }
                  },
                  condition: {
                    nesting_mode: 'list',
                    min_items: 1
                  }
                }
              }
            },
            aws_instance: {
              version: 0,
              block: {
                attributes: {
                  ami: {
                    type: 'string',
                    required: true
                  }
                }
              }
            }
          }
        }
      }
    }, null, 2),
    'utf8'
  );

  return terraformRoot;
}
