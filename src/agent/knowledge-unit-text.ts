import type { KnowledgePackUnit } from '../knowledge/pack.ts';

function appendOptional(parts: string[], value: string | undefined): void {
  if (value !== undefined) {
    parts.push(value);
  }
}

export function knowledgeUnitSearchText(unit: KnowledgePackUnit): string {
  const textParts = [
    unit.unitType,
    unit.path,
    unit.summary,
    unit.extractionMethod,
    unit.sourceLocator,
    unit.privacyScope,
    ...(unit.relatedPaths ?? [])
  ];

  switch (unit.unitType) {
    case 'fact':
      textParts.push(unit.factKind);
      textParts.push(...(unit.values ?? []));
      appendOptional(textParts, unit.type);
      appendOptional(textParts, unit.defaultValue);
      break;
    case 'guidance':
      textParts.push(unit.topic);
      textParts.push(...(unit.appliesWhen ?? []));
      textParts.push(...(unit.avoidWhen ?? []));
      appendOptional(textParts, unit.risk);
      break;
    case 'example':
      textParts.push(unit.exampleType);
      appendOptional(textParts, unit.language);
      textParts.push(unit.snippet);
      textParts.push(...(unit.appliesWhen ?? []));
      textParts.push(...(unit.avoidWhen ?? []));
      break;
    case 'diagnostic':
      textParts.push(
        unit.engine,
        unit.signature,
        unit.likelyCause,
        ...unit.recommendedReview
      );
      break;
    case 'recipe':
      textParts.push(
        unit.name,
        ...unit.steps
      );
      break;
  }

  return textParts.join(' ');
}

export function knowledgeUnitIncludesText(unit: KnowledgePackUnit, pattern: RegExp): boolean {
  pattern.lastIndex = 0;
  return pattern.test(knowledgeUnitSearchText(unit));
}
