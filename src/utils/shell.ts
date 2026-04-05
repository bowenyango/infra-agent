export function getPreferredShell(): string {
  return process.env.SHELL || '/bin/sh';
}
