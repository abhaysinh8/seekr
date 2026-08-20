export type Comparator<T> = (left: T, right: T) => number;

export class MinHeap<T> {
  readonly #items: T[] = [];

  public constructor(private readonly compare: Comparator<T>) {}

  public get size(): number {
    return this.#items.length;
  }

  public peek(): T | undefined {
    return this.#items[0];
  }

  public push(value: T): void {
    this.#items.push(value);
    this.bubbleUp(this.#items.length - 1);
  }

  public pop(): T | undefined {
    const root = this.#items[0];
    const last = this.#items.pop();
    if (this.#items.length > 0 && last !== undefined) {
      this.#items[0] = last;
      this.bubbleDown(0);
    }
    return root;
  }

  private bubbleUp(start: number): void {
    let index = start;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const value = this.#items[index];
      const parentValue = this.#items[parent];
      if (value === undefined || parentValue === undefined || this.compare(value, parentValue) >= 0)
        return;
      [this.#items[index], this.#items[parent]] = [parentValue, value];
      index = parent;
    }
  }

  private bubbleDown(start: number): void {
    let index = start;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      const leftValue = this.#items[left];
      const smallestValue = this.#items[smallest];
      if (
        leftValue !== undefined &&
        smallestValue !== undefined &&
        this.compare(leftValue, smallestValue) < 0
      ) {
        smallest = left;
      }
      const rightValue = this.#items[right];
      const updatedSmallestValue = this.#items[smallest];
      if (
        rightValue !== undefined &&
        updatedSmallestValue !== undefined &&
        this.compare(rightValue, updatedSmallestValue) < 0
      ) {
        smallest = right;
      }
      if (smallest === index) return;
      [this.#items[index], this.#items[smallest]] = [
        this.#items[smallest] as T,
        this.#items[index] as T,
      ];
      index = smallest;
    }
  }
}

/** Selects the best K values without sorting the full input. `compareBest` follows Array.sort. */
export function selectTopK<T>(values: Iterable<T>, k: number, compareBest: Comparator<T>): T[] {
  if (k <= 0) return [];
  const heap = new MinHeap<T>((left, right) => -compareBest(left, right));

  for (const value of values) {
    if (heap.size < k) heap.push(value);
    else {
      const worst = heap.peek();
      if (worst !== undefined && compareBest(value, worst) < 0) {
        heap.pop();
        heap.push(value);
      }
    }
  }

  const selected: T[] = [];
  while (heap.size > 0) selected.push(heap.pop() as T);
  return selected.sort(compareBest);
}
