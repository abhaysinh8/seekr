import { tokenize } from '@seekr/tokenizer';

export interface SynonymRule {
  readonly source: string;
  readonly targets: readonly string[];
  readonly bidirectional?: boolean;
}

export class SynonymMap {
  readonly #expansions = new Map<string, Set<string>>();
  constructor(rules: readonly SynonymRule[] = []) {
    for (const rule of rules) this.add(rule);
  }
  add(rule: SynonymRule): void {
    const sources = tokenize(rule.source);
    if (sources.length === 0) return;
    const targets = rule.targets.flatMap((target) => tokenize(target));
    for (const source of sources) {
      for (const target of targets) {
        if (target !== source) add(this.#expansions, source, target);
        if (rule.bidirectional === true && target !== source) add(this.#expansions, target, source);
      }
    }
  }
  expand(term: string): readonly string[] {
    return [...(this.#expansions.get(term) ?? [])];
  }
}

function add(map: Map<string, Set<string>>, source: string, target: string): void {
  let values = map.get(source);
  if (values === undefined) {
    values = new Set();
    map.set(source, values);
  }
  values.add(target);
}
