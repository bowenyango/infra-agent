import { join } from 'node:path';
import type { InfraDomainId } from '../types/repository.ts';

function buildHelmCandidateFiles(dirName: string): string[] {
  return [
    join(dirName, 'Chart.yaml'),
    join(dirName, 'values.yaml'),
    join(dirName, 'templates/deployment.yaml'),
    join(dirName, 'templates/ingress.yaml')
  ];
}

function buildPulumiCandidateFiles(dirName: string, listedFiles: string[]): string[] {
  const candidateFiles: string[] = [];

  for (const listedFile of listedFiles) {
    if (/^Pulumi(\..+)?\.(yaml|yml)$/i.test(listedFile)) {
      candidateFiles.push(join(dirName, listedFile));
    }
  }

  return candidateFiles;
}

function buildTerraformCandidateFiles(dirName: string, listedFiles: string[]): string[] {
  const candidateFiles = [
    join(dirName, 'main.tf'),
    join(dirName, 'variables.tf'),
    join(dirName, 'terraform.tfvars'),
    join(dirName, 'terraform.auto.tfvars')
  ];

  for (const listedFile of listedFiles) {
    if (/\.tf$/i.test(listedFile) || /\.tfvars(\.json)?$/i.test(listedFile)) {
      candidateFiles.push(join(dirName, listedFile));
    }
  }

  return candidateFiles;
}

export function buildInspectionCandidateFiles(params: {
  dirName: string;
  listedFiles: string[];
  requestedDomains: InfraDomainId[];
}): string[] {
  const { dirName, listedFiles, requestedDomains } = params;
  const domainOrder = requestedDomains.length > 0 ? requestedDomains : ['helm', 'pulumi', 'terraform'];
  const candidateFiles: string[] = [];

  for (const domainId of domainOrder) {
    if (domainId === 'helm') {
      candidateFiles.push(...buildHelmCandidateFiles(dirName));
      continue;
    }

    if (domainId === 'pulumi') {
      candidateFiles.push(...buildPulumiCandidateFiles(dirName, listedFiles));
      continue;
    }

    if (domainId === 'terraform') {
      candidateFiles.push(...buildTerraformCandidateFiles(dirName, listedFiles));
    }
  }

  return candidateFiles;
}

export function buildInspectionSearchPattern(requestedDomains: InfraDomainId[]): string {
  const domains = requestedDomains.length > 0 ? requestedDomains : ['helm', 'pulumi', 'terraform'];
  const patterns: string[] = [];

  if (domains.includes('helm')) {
    patterns.push('Chart\\.ya?ml', 'values\\.ya?ml', 'deployment\\.ya?ml', 'ingress\\.ya?ml');
  }

  if (domains.includes('pulumi')) {
    patterns.push('Pulumi(\\..+)?\\.(yaml|yml)');
  }

  if (domains.includes('terraform')) {
    patterns.push('.*\\.tf', '.*\\.tfvars(?:\\.json)?');
  }

  return `^(${patterns.join('|')})$`;
}
