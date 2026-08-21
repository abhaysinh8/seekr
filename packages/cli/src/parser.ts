export interface ParsedArguments {
  readonly command: readonly string[];
  readonly flags: Readonly<Record<string, string | boolean>>;
}

export function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const command: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const value = arguments_[index] as string;
    if (!value.startsWith('--')) {
      command.push(value);
      continue;
    }
    const [rawName, inline] = value.slice(2).split('=', 2);
    const name = camelCase(rawName ?? '');
    const following = arguments_[index + 1];
    if (inline !== undefined) flags[name] = inline;
    else if (following !== undefined && !following.startsWith('--')) {
      flags[name] = following;
      index += 1;
    } else flags[name] = true;
  }
  return { command, flags };
}

const camelCase = (value: string): string =>
  value.replace(/-([a-z])/gu, (_, character: string) => character.toUpperCase());
