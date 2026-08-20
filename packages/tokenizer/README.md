# `@seekr/tokenizer`

Seekr's dependency-free text-processing pipeline, shared by indexing and query analysis. Every transformation is available independently, while `tokenize` and `tokenizeDetailed` provide the standard pipeline.

## Defaults

The default pipeline applies these stages in order:

1. NFKC Unicode normalization
2. lowercase conversion
3. punctuation and symbol replacement with spaces
4. whitespace normalization
5. token splitting
6. empty token removal
7. English stop-word removal
8. optional consumer-supplied stemming
9. optional n-gram generation

Stemming and n-grams are disabled unless configured. The built-in stop-word list is intentionally small and can be disabled or replaced.

## Basic usage

```ts
import { tokenize, tokenizeDetailed } from '@seekr/tokenizer';

tokenize('Machine Learning models are AMAZING!');
// ['machine', 'learning', 'models', 'amazing']

tokenizeDetailed('Machine learning');
// [
//   { token: 'machine', position: 0, startOffset: 0, endOffset: 7 },
//   { token: 'learning', position: 1, startOffset: 8, endOffset: 16 },
// ]
```

Offsets are end-exclusive UTF-16 offsets into the original input, even when Unicode normalization changes the normalized string's length. Positions are assigned before stop-word removal, so removed words leave gaps needed by phrase and proximity queries.

## Stop words

```ts
tokenize('the search index', { stopWordRemoval: false });
// ['the', 'search', 'index']

tokenize('internal search index', {
  stopWords: new Set(['internal']),
});
// ['search', 'index']
```

Supplying `stopWords` replaces the default English set. Values are normalized with the same case, Unicode, and punctuation options as input tokens.

## Stemming

Seekr does not bundle a language-specific stemmer. Supply a strategy when a project needs one:

```ts
const stemmer = {
  stem(token: string) {
    return token.endsWith('s') ? token.slice(0, -1) : token;
  },
};

tokenize('models', { stemmer });
// ['model']
```

The same strategy must be used for both indexing and querying.

## N-grams

```ts
import { generateNGrams, tokenize } from '@seekr/tokenizer';

generateNGrams(['machine', 'learning'], { minN: 2, maxN: 2 });
// ['machine learning']

tokenize('machine learning models', {
  nGrams: { minN: 1, maxN: 2 },
});
// unigrams followed by bigrams
```

The configured range controls the complete output. Use `minN: 1` when unigrams should be retained alongside larger grams.

## Independent stages

The package also exports `normalizeUnicode`, `convertToLowercase`, `handlePunctuation`, `normalizeWhitespace`, `splitTokens`, `removeEmptyTokens`, `removeStopWords`, `applyStemmer`, `normalizeToken`, and `generateNGrams` for custom analyzers.
