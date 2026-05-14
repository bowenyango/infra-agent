import { join } from 'node:path';
import type { AgentRuntimeState } from '../../types/agent.ts';
import type { EditPlan } from '../../types/edit-plan.ts';
import { knowledgeUnitIncludesText } from '../knowledge-unit-text.ts';
import { getLatestFileContent } from './runtime-file-content.ts';

const TERRAFORM_ADDRESS_PATTERN =
  '(?:(?:module\\.[A-Za-z0-9_-]+(?:\\[[^\\]\\s]+\\])?\\.)*(?:data\\.)?[A-Za-z][A-Za-z0-9_]*_[A-Za-z0-9_]*\\.[A-Za-z][A-Za-z0-9_]*(?:\\[[^\\]\\s]+\\])?)';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTerraformMovedBlockKnowledge(runtime: AgentRuntimeState): boolean {
  const movedBlockPattern = /\b(terraform|hcl)\b.*\b(rename|renaming|moved[- ]block|moved[- ]blocks|resource[- ]address|state mv|import\/state)\b|\b(rename|renaming|moved[- ]block|moved[- ]blocks|resource[- ]address|state mv|import\/state)\b.*\b(terraform|hcl)\b/i;
  return (runtime.knowledgeFacts?.units ?? []).some(unit => knowledgeUnitIncludesText(unit, movedBlockPattern));
}

function taskRequestsTerraformMovedBlock(task: string): boolean {
  return /\b(terraform|hcl)\b/i.test(task)
    && /\b(rename|renaming|moved[- ]block|moved[- ]blocks|move resource|resource[- ]address|refactor|retain existing|state mv)\b/i.test(task);
}

function findTerraformAddressPairs(task: string): Array<{ from: string; to: string }> {
  const pairs: Array<{ from: string; to: string }> = [];
  const pairPatterns = [
    new RegExp(`\\bfrom\\s*[:=]?\\s*(${TERRAFORM_ADDRESS_PATTERN})\\s+\\bto\\s*[:=]?\\s*(${TERRAFORM_ADDRESS_PATTERN})`, 'gi'),
    new RegExp(`\\bold\\s*[:=]?\\s*(${TERRAFORM_ADDRESS_PATTERN})\\s+\\bnew\\s*[:=]?\\s*(${TERRAFORM_ADDRESS_PATTERN})`, 'gi'),
    new RegExp(`\\brename\\s+(${TERRAFORM_ADDRESS_PATTERN})\\s+\\bto\\s+(${TERRAFORM_ADDRESS_PATTERN})`, 'gi'),
    new RegExp(`\\bmove\\s+(${TERRAFORM_ADDRESS_PATTERN})\\s+\\bto\\s+(${TERRAFORM_ADDRESS_PATTERN})`, 'gi'),
    new RegExp(`(${TERRAFORM_ADDRESS_PATTERN})\\s*(?:->|=>)\\s*(${TERRAFORM_ADDRESS_PATTERN})`, 'gi')
  ];

  for (const pattern of pairPatterns) {
    for (const match of task.matchAll(pattern)) {
      const from = match[1]?.trim();
      const to = match[2]?.trim();
      if (!from || !to || from === to) {
        continue;
      }

      if (!pairs.some(pair => pair.from === from && pair.to === to)) {
        pairs.push({ from, to });
      }
    }
  }

  return pairs;
}

function renderMovedBlock(pair: { from: string; to: string }): string {
  return [
    'moved {',
    `  from = ${pair.from}`,
    `  to   = ${pair.to}`,
    '}',
    ''
  ].join('\n');
}

function containsMovedBlock(content: string, pair: { from: string; to: string }): boolean {
  const fromPattern = escapeRegExp(pair.from);
  const toPattern = escapeRegExp(pair.to);
  return new RegExp(`moved\\s*\\{[^}]*\\bfrom\\s*=\\s*${fromPattern}\\b[^}]*\\bto\\s*=\\s*${toPattern}\\b[^}]*\\}`, 's')
    .test(content);
}

export function buildTerraformMovedBlockEditPlan(runtime: AgentRuntimeState): EditPlan | null {
  if (!taskRequestsTerraformMovedBlock(runtime.task)) {
    return null;
  }

  if (!hasTerraformMovedBlockKnowledge(runtime)) {
    return null;
  }

  const topTerraformTarget = runtime.preflight.targetCandidates.find(candidate => candidate.kind === 'terraform-root');
  if (!topTerraformTarget) {
    return null;
  }

  const root = runtime.preflight.inspection.terraformRoots.find(candidate => candidate.rootPath === topTerraformTarget.path);
  if (!root) {
    return null;
  }

  const addressPairs = findTerraformAddressPairs(runtime.task);
  if (addressPairs.length === 0) {
    return null;
  }

  const movedPath = join(root.rootPath, 'moved.tf');
  const existingContent = getLatestFileContent(runtime, movedPath);
  const newBlocks = addressPairs
    .filter(pair => existingContent === null || !containsMovedBlock(existingContent, pair))
    .map(renderMovedBlock);
  if (newBlocks.length === 0) {
    return null;
  }

  const nextContent = existingContent === null || existingContent.trim().length === 0
    ? newBlocks.join('\n')
    : `${existingContent.trimEnd()}\n\n${newBlocks.join('\n')}`;

  return {
    kind: 'terraform-moved-block',
    summary: `Add Terraform moved block guidance to ${movedPath}.`,
    rationale: 'The task includes explicit Terraform old/new resource addresses and compact RAG units indicate that logical resource renames should use moved blocks to retain existing remote objects.',
    writes: [
      {
        path: movedPath,
        content: nextContent,
        reason: 'Record the explicit Terraform resource-address rename as a bounded moved block.'
      }
    ]
  };
}
