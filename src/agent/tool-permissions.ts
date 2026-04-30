import type { ToolSafety } from '../Tool.ts';

export type ToolPermissionCategory =
  | 'workspace-read'
  | 'workspace-write'
  | 'local-validation'
  | 'native-cli-read'
  | 'native-cli-validation'
  | 'native-cli-write'
  | 'native-stack-config-write'
  | 'approval-required'
  | 'unknown';

export interface ToolPermissionSummary {
  category: ToolPermissionCategory;
  mutatesWorkspace: boolean;
  mutatesExternalState: boolean;
  externalCommand: boolean;
  approvalRequired: boolean;
}

export interface ToolPermissionAggregate {
  totalToolCount: number;
  workspaceMutationToolCount: number;
  externalCommandToolCount: number;
  externalStateMutationToolCount: number;
  approvalRequiredToolCount: number;
  categories: Partial<Record<ToolPermissionCategory, number>>;
}

function summary(params: ToolPermissionSummary): ToolPermissionSummary {
  return params;
}

export function classifyToolPermission(toolName: string, safety: ToolSafety): ToolPermissionSummary {
  if (safety === 'approval_required') {
    return summary({
      category: 'approval-required',
      mutatesWorkspace: false,
      mutatesExternalState: false,
      externalCommand: false,
      approvalRequired: true
    });
  }

  switch (toolName) {
    case 'list_directory':
    case 'search_workspace':
    case 'read_file':
    case 'diff_preview':
      return summary({
        category: 'workspace-read',
        mutatesWorkspace: false,
        mutatesExternalState: false,
        externalCommand: false,
        approvalRequired: false
      });
    case 'write_file':
    case 'append_file':
    case 'replace_file':
      return summary({
        category: 'workspace-write',
        mutatesWorkspace: true,
        mutatesExternalState: false,
        externalCommand: false,
        approvalRequired: false
      });
    case 'validate_yaml_syntax':
      return summary({
        category: 'local-validation',
        mutatesWorkspace: false,
        mutatesExternalState: false,
        externalCommand: false,
        approvalRequired: false
      });
    case 'helm_show_chart':
    case 'helm_show_values':
      return summary({
        category: 'native-cli-read',
        mutatesWorkspace: false,
        mutatesExternalState: false,
        externalCommand: true,
        approvalRequired: false
      });
    case 'validate_targets':
      return summary({
        category: 'native-cli-validation',
        mutatesWorkspace: false,
        mutatesExternalState: false,
        externalCommand: true,
        approvalRequired: false
      });
    case 'terraform_fmt':
      return summary({
        category: 'native-cli-write',
        mutatesWorkspace: true,
        mutatesExternalState: false,
        externalCommand: true,
        approvalRequired: false
      });
    case 'pulumi_config_set':
      return summary({
        category: 'native-stack-config-write',
        mutatesWorkspace: true,
        mutatesExternalState: true,
        externalCommand: true,
        approvalRequired: false
      });
    default:
      return summary({
        category: safety === 'read_only' ? 'workspace-read' : 'unknown',
        mutatesWorkspace: safety === 'write_scoped',
        mutatesExternalState: false,
        externalCommand: safety === 'validate',
        approvalRequired: false
      });
  }
}

export function aggregateToolPermissions(permissions: ToolPermissionSummary[]): ToolPermissionAggregate {
  const categories: Partial<Record<ToolPermissionCategory, number>> = {};

  for (const permission of permissions) {
    categories[permission.category] = (categories[permission.category] ?? 0) + 1;
  }

  return {
    totalToolCount: permissions.length,
    workspaceMutationToolCount: permissions.filter(permission => permission.mutatesWorkspace).length,
    externalCommandToolCount: permissions.filter(permission => permission.externalCommand).length,
    externalStateMutationToolCount: permissions.filter(permission => permission.mutatesExternalState).length,
    approvalRequiredToolCount: permissions.filter(permission => permission.approvalRequired).length,
    categories
  };
}
