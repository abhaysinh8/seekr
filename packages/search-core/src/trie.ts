interface TrieNode {
  readonly children: Map<string, TrieNode>;
  terminal: boolean;
}

const createNode = (): TrieNode => ({ children: new Map(), terminal: false });

export class Trie {
  readonly #root = createNode();

  public insert(term: string): void {
    let node = this.#root;
    for (const character of term) {
      let child = node.children.get(character);
      if (child === undefined) {
        child = createNode();
        node.children.set(character, child);
      }
      node = child;
    }
    node.terminal = true;
  }

  public remove(term: string): boolean {
    const removeAt = (node: TrieNode, characters: readonly string[], depth: number): boolean => {
      if (depth === characters.length) {
        if (!node.terminal) return false;
        node.terminal = false;
        return node.children.size === 0;
      }
      const character = characters[depth];
      if (character === undefined) return false;
      const child = node.children.get(character);
      if (child === undefined) return false;
      if (removeAt(child, characters, depth + 1)) node.children.delete(character);
      return !node.terminal && node.children.size === 0;
    };

    const existed = this.contains(term);
    removeAt(this.#root, Array.from(term), 0);
    return existed;
  }

  public contains(term: string): boolean {
    return this.findNode(term)?.terminal ?? false;
  }

  public startsWith(prefix: string): boolean {
    return this.findNode(prefix) !== undefined;
  }

  public suggest(prefix: string, limit = 10, score: (term: string) => number = () => 0): string[] {
    if (limit <= 0) return [];
    const node = this.findNode(prefix);
    if (node === undefined) return [];
    const terms: string[] = [];

    const visit = (current: TrieNode, value: string) => {
      if (current.terminal) terms.push(value);
      for (const [character, child] of current.children) visit(child, value + character);
    };
    visit(node, prefix);

    return terms
      .sort((left, right) => score(right) - score(left) || left.localeCompare(right))
      .slice(0, limit);
  }

  public clear(): void {
    this.#root.children.clear();
    this.#root.terminal = false;
  }

  private findNode(value: string): TrieNode | undefined {
    let node = this.#root;
    for (const character of value) {
      const child = node.children.get(character);
      if (child === undefined) return undefined;
      node = child;
    }
    return node;
  }
}
