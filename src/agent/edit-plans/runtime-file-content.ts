import type { AgentRuntimeState } from '../../types/agent.ts';
import type { FileReadOutput, WriteFileOutput } from '../../types/tools.ts';

export function getLatestFileContent(runtime: AgentRuntimeState, relativePathSuffix: string): string | null {
  for (let index = runtime.observations.length - 1; index >= 0; index -= 1) {
    const observation = runtime.observations[index];

    if (observation.toolName === 'read_file') {
      const output = observation.output as FileReadOutput;
      if (output.path.endsWith(relativePathSuffix)) {
        return output.content;
      }
    }

    if (observation.toolName === 'write_file') {
      const output = observation.output as WriteFileOutput;
      if (output.path.endsWith(relativePathSuffix)) {
        return output.content;
      }
    }
  }

  return null;
}
