import type { Tool } from '../../Tool.ts';
import type { YamlSyntaxValidationOutput } from '../../types/tools.ts';
import { validateYamlSyntax } from '../../validators/yaml-syntax.ts';

export interface ValidateYamlSyntaxInput {
  path: string;
  content: string;
}

export const ValidateYamlSyntaxTool: Tool<ValidateYamlSyntaxInput, YamlSyntaxValidationOutput> = {
  name: 'validate_yaml_syntax',
  description: 'Parse planned YAML content before or after a scoped workspace write.',
  safety: 'validate',
  async execute(input, context) {
    const validation = await validateYamlSyntax(input.content);

    return {
      toolName: 'validate_yaml_syntax',
      safety: 'validate',
      output: {
        workspaceRoot: context.workspaceRoot,
        path: input.path,
        parser: validation.parser,
        result: {
          command: `infra-agent yaml-parse ${input.path}`,
          exitCode: validation.valid ? 0 : 1,
          stdout: [`parser: ${validation.parser}`, validation.stdout].filter(Boolean).join('\n'),
          stderr: validation.stderr
        }
      }
    };
  }
};
