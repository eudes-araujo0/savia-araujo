export function runtimeValue(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function runtimeFlag(name: string): boolean {
  return runtimeValue(name).toLowerCase() === 'true';
}
