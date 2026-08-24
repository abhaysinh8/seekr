# Graph Report - seekr  (2026-08-24)

## Corpus Check
- 260 files · ~65,390 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1966 nodes · 3627 edges · 105 communities (96 shown, 9 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 145 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Search Analytics Client
- Collaborative Recommender
- Metrics Registry
- Text Normalization
- Highlighting & Ranking
- Inverted Index Core
- File Segment Store
- Catalog Store
- Web App Lint Config
- API Keys & Auth
- API Server Deps
- Fastify App Setup
- Background Jobs
- Analytics Repository
- Crawl Repository
- Crawler Deps
- Next.js Web Deps
- API Route Tests
- Example App Deps
- Recommendation Evaluation
- Search Response Cache
- Documents & Playground Pages
- CLI Package Deps
- Shared Package Deps
- Tokenizer Package Deps
- Query Suggestions
- Index API Schemas
- Config Package Deps
- Database Client & Migrations
- SDK Package Deps
- Analytics Routes
- Cache & Server Bootstrap
- Load Testing Harness
- Web Crawler Engine
- Base TS Config
- Shared Package Manifest
- Robots.txt Handling
- CLI Configuration
- Next.js TS Config
- SDK Package Manifest
- HTTP Page Fetcher
- Turbo Build Pipeline
- Docs Concepts & Examples
- Indexes Page UI
- Index Detail UI
- In-Memory Index Service
- App TS Config
- Environment Schemas
- Min-Heap Priority Queue
- Levenshtein Fuzzy Matching
- Snapshot Manager
- Recommendation Service
- Crawler Runtime Jobs
- Package TS Config
- Benchmarks & Fixtures
- Crawler API Schemas
- Core Entities & Schemas
- API Keys Page UI
- Crawler Dashboard UI
- Search API Schemas
- Analytics Dashboard UI
- Root Layout & Icons
- Recommendations Page UI
- Settings Page UI
- Search Algorithm Concepts
- Architecture Decisions
- Persistent Index Storage
- Build Output TS Config A
- Crawler Types & Tests
- Build Output TS Config B
- Node TS Config
- Composite TS Config A
- TS Config C
- Composite TS Config B
- TS Config D
- Page Content Extraction
- Link Discovery & URL Safety
- Overview Dashboard UI
- Docs Search Example UI
- TS Config E
- TS Config F
- TS Config G
- Synonym Map
- Vitest Root Config
- Auth Hooks
- Index Detail Actions
- Storage Architecture Docs
- API Key API Schemas
- Recommendation API Schemas
- Security Concepts
- Example Bootstrap Scripts
- Field Value Resolution
- Prettier Config
- Recommendation Concepts
- Analytics API Schemas
- Health Check Schemas
- Seed Script
- Next Env Types A
- Next Env Types B
- Vitest Root
- Code of Conduct
- Seekr Config Package

## God Nodes (most connected - your core abstractions)
1. `InMemoryInvertedIndex` - 39 edges
2. `RequestOptions` - 35 edges
3. `IndexManagementService` - 34 edges
4. `buildApp()` - 32 edges
5. `SearchIndex` - 31 edges
6. `ImmutableSegmentIndex` - 27 edges
7. `apiRequest()` - 25 edges
8. `InMemoryIndexService` - 23 edges
9. `InteractionStore` - 22 edges
10. `SearchDocument` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Basic Example` ----> `Fastify API`  [AMBIGUOUS]
  examples/basic/README.md → docs/api.md
- `Audit Report` ----> `Seekr`  [EXTRACTED]
  docs/audit.md → README.md
- `Fastify API` ----> `Scoped API Keys`  [EXTRACTED]
  docs/api.md → SECURITY.md
- `@seekr/search-core` ----> `TF-IDF`  [EXTRACTED]
  packages/search-core/README.md → docs/architecture.md
- `Seekr` ----> `Dependency Direction Rule`  [EXTRACTED]
  README.md → docs/architecture.md

## Import Cycles
- None detected.

## Communities (105 total, 9 thin omitted)

### Community 0 - "Search Analytics Client"
Cohesion: 0.09
Nodes (23): AnalyticsClient, backoff(), documentPath(), DocumentsClient, IndexesClient, InternalRequest, RecommendationsClient, SeekrClient (+15 more)

### Community 1 - "Collaborative Recommender"
Cohesion: 0.10
Nodes (28): addNeighbor(), ItemItemCollaborativeRecommender, pairKey(), matrix(), ContentBasedRecommender, items, HybridRecommendationOptions, HybridRecommender (+20 more)

### Community 2 - "Metrics Registry"
Cohesion: 0.08
Nodes (17): Counter, escapeLabel(), MetricsRegistry, ManagedIndexRecord, IndexManagementService, notFound(), toEngineConfiguration(), toSearchDocument() (+9 more)

### Community 3 - "Text Normalization"
Cohesion: 0.10
Nodes (39): convertToLowercase(), graphemeSegmenter, handleMappedPunctuation(), lowercaseMappedText(), MappedCharacter, mapSourceText(), normalizeMappedWhitespace(), splitMappedTokens() (+31 more)

### Community 4 - "Highlighting & Ranking"
Cohesion: 0.07
Nodes (30): escapeHtml(), highlightField(), mergeRanges(), Range, validateTag(), ParsedPhrase, RankingStrategy, compareByScore() (+22 more)

### Community 5 - "Inverted Index Core"
Cohesion: 0.08
Nodes (19): cloneDocument(), cloneValue(), DocumentPostings, fieldText(), InMemoryInvertedIndex, isScalarArray(), MutableFieldPosting, scalarValues() (+11 more)

### Community 6 - "File Segment Store"
Cohesion: 0.10
Nodes (12): FileSystemSegmentStore, isNotFound(), emptyManifest(), ImmutableSegmentIndex, MemorySegmentStore, roots, ImmutableSegmentOptions, SegmentData (+4 more)

### Community 7 - "Catalog Store"
Cohesion: 0.05
Nodes (13): CatalogStore, DatedRow, DocumentRow, IndexRow, InMemoryCatalogStore, ManagedDocumentRecord, mapDocument(), mapIndex() (+5 more)

### Community 8 - "Web App Lint Config"
Cohesion: 0.04
Nodes (47): eslint, @eslint/js, eslint-plugin-react-hooks, @next/eslint-plugin-next, description, devDependencies, eslint, @eslint/js (+39 more)

### Community 9 - "API Keys & Auth"
Cohesion: 0.07
Nodes (16): schema, ApiKeyRouteOptions, ApiKeyRecord, ApiKeyRepository, ApiKeyRow, InMemoryApiKeyRepository, mapRow(), NewApiKeyRecord (+8 more)

### Community 10 - "API Server Deps"
Cohesion: 0.04
Nodes (44): dependencies, fastify, @fastify/cors, @fastify/sensible, ioredis, pino-pretty, postgres, @seekr/config (+36 more)

### Community 11 - "Fastify App Setup"
Cohesion: 0.10
Nodes (27): AppDependencies, BuildAppOptions, createRateLimitHook(), Window, HttpError, apiKeyRoutes(), assertProject(), assertProject() (+19 more)

### Community 12 - "Background Jobs"
Cohesion: 0.07
Nodes (9): jobTimer, validateProgress(), InMemoryJobRepository, JobPayload, JobRepository, JobRow, mapRow(), PostgresJobRepository (+1 more)

### Community 13 - "Analytics Repository"
Cohesion: 0.09
Nodes (13): AnalyticsRepository, ClickAnalyticsRecord, ClickRow, InMemoryAnalyticsRepository, inRange(), NewSearchRecord, PostgresAnalyticsRepository, requiredRow() (+5 more)

### Community 14 - "Crawl Repository"
Cohesion: 0.08
Nodes (10): CrawlJobRecord, CrawlJobRow, CrawlRepository, CrawlSourceRecord, CrawlSourceRow, InMemoryCrawlRepository, mapJob(), mapSource() (+2 more)

### Community 15 - "Crawler Deps"
Cohesion: 0.06
Nodes (33): dependencies, cheerio, pino, pino-pretty, postgres, @seekr/config, @seekr/shared, devDependencies (+25 more)

### Community 16 - "Next.js Web Deps"
Cohesion: 0.06
Nodes (33): dependencies, next, react, react-dom, zod, devDependencies, postcss, tailwindcss (+25 more)

### Community 17 - "API Route Tests"
Cohesion: 0.12
Nodes (18): buildApp(), fixture(), healthyDependency(), fixture(), healthyDependency(), createApp(), healthyDependency(), checkDependency() (+10 more)

### Community 18 - "Example App Deps"
Cohesion: 0.06
Nodes (31): dependencies, next, react, react-dom, @seekr/sdk, devDependencies, tsx, @types/node (+23 more)

### Community 19 - "Recommendation Evaluation"
Cohesion: 0.14
Nodes (23): dcgAtK(), evaluateConfigurations(), EvaluationConfiguration, EvaluationDataset, EvaluationResult, formatEvaluationTable(), mean(), ndcgAtK() (+15 more)

### Community 20 - "Search Response Cache"
Cohesion: 0.11
Nodes (9): createDeterministicCacheKey(), SearchResponseCache, stableStringify(), response, CacheStore, MemoryCacheStore, MemoryEntry, RedisCacheStore (+1 more)

### Community 21 - "Documents & Playground Pages"
Cohesion: 0.10
Nodes (14): metadata, Job, Source, DocumentsOverview(), FilterInput, ResultCard(), SearchPlayground(), apiUrl() (+6 more)

### Community 22 - "CLI Package Deps"
Cohesion: 0.07
Nodes (26): bin, seekr, dependencies, @seekr/sdk, description, devDependencies, @types/node, typescript (+18 more)

### Community 23 - "Shared Package Deps"
Cohesion: 0.08
Nodes (25): dependencies, @seekr/shared, description, devDependencies, @types/node, typescript, exports, files (+17 more)

### Community 24 - "Tokenizer Package Deps"
Cohesion: 0.08
Nodes (25): dependencies, @seekr/tokenizer, devDependencies, tsx, @types/node, typescript, exports, files (+17 more)

### Community 25 - "Query Suggestions"
Cohesion: 0.12
Nodes (9): normalizeQuery(), QuerySignals, QuerySuggestion, QuerySuggestionIndex, QuerySuggestionOptions, SuggestionResponse, createNode(), Trie (+1 more)

### Community 26 - "Index API Schemas"
Cohesion: 0.16
Nodes (22): AddDocumentApiRequest, addDocumentRequestSchema, bulkDocumentsRequestSchema, CreateIndexApiRequest, createIndexRequestSchema, CreateProjectApiRequest, createProjectRequestSchema, documentFieldValueSchema (+14 more)

### Community 27 - "Config Package Deps"
Cohesion: 0.09
Nodes (22): dependencies, @seekr/tokenizer, devDependencies, typescript, vitest, exports, files, dist (+14 more)

### Community 28 - "Database Client & Migrations"
Cohesion: 0.11
Nodes (10): createDatabase(), Database, database, environment, migrationsUrl, InMemoryInteractionRepository, InteractionRepository, InteractionRow (+2 more)

### Community 29 - "SDK Package Deps"
Cohesion: 0.09
Nodes (21): dependencies, zod, devDependencies, @types/node, typescript, exports, files, dist (+13 more)

### Community 30 - "Analytics Routes"
Cohesion: 0.15
Nodes (9): AnalyticsRouteOptions, analyticsRoutes(), cleanFilters(), cleanHighlight(), cleanTypoTolerance(), SearchRouteOptions, searchRoutes(), IndexSearchService (+1 more)

### Community 31 - "Cache & Server Bootstrap"
Cohesion: 0.11
Nodes (17): Cache, createCache(), analytics, apiKeys, backgroundJobs, cache, catalogStore, crawls (+9 more)

### Community 32 - "Load Testing Harness"
Cohesion: 0.13
Nodes (14): analytics(), autocomplete(), concurrency, durations, durationSeconds, indexId, ingest(), outputPath (+6 more)

### Community 33 - "Web Crawler Engine"
Cohesion: 0.18
Nodes (11): QueueEntry, ResolvedConfiguration, toCrawledDocument(), validateConfiguration(), WebCrawler, WebCrawlerDependencies, OriginRateLimiter, CrawlFailure (+3 more)

### Community 34 - "Base TS Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, composite, declaration, declarationMap, esModuleInterop, exactOptionalPropertyTypes (+11 more)

### Community 35 - "Shared Package Manifest"
Cohesion: 0.10
Nodes (19): dependencies, zod, devDependencies, typescript, exports, files, dist, typescript (+11 more)

### Community 36 - "Robots.txt Handling"
Cohesion: 0.14
Nodes (8): DefaultRobotsTextLoader, parseRobots(), RobotsGroup, RobotsPolicy, RobotsRule, RobotsTextLoader, RobotsTxtCache, selectGroups()

### Community 37 - "CLI Configuration"
Cohesion: 0.21
Nodes (13): asString(), CliConfiguration, readConfig(), resolveConfiguration(), jsonInput(), requestOptions(), required(), run() (+5 more)

### Community 38 - "Next.js TS Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, composite, declaration, declarationMap, incremental, jsx, lib (+9 more)

### Community 39 - "SDK Package Manifest"
Cohesion: 0.11
Nodes (17): devDependencies, typescript, exports, files, dist, README.md, typescript, main (+9 more)

### Community 40 - "HTTP Page Fetcher"
Cohesion: 0.18
Nodes (8): CrawlFetchError, HTML_CONTENT_TYPES, HttpPageFetcher, HttpPageFetcherOptions, readLimitedBody(), RETRYABLE_STATUS_CODES, FetchedPage, PageFetcher

### Community 41 - "Turbo Build Pipeline"
Cohesion: 0.12
Nodes (16): ^build, !.next/cache/**, dependsOn, outputs, cache, cache, persistent, dist/** (+8 more)

### Community 42 - "Docs Concepts & Examples"
Cohesion: 0.16
Nodes (16): Search Analytics, Prometheus Metrics, Basic Example, Docs Search Example, seekr-cli, @seekr/sdk, @seekr/shared, Load Testing (+8 more)

### Community 43 - "Indexes Page UI"
Cohesion: 0.13
Nodes (5): nextConfig, metadata, defaultSchema, metadata, .next/**

### Community 44 - "Index Detail UI"
Cohesion: 0.13
Nodes (4): metadata, DocumentView, Tab, tabs

### Community 46 - "App TS Config"
Cohesion: 0.14
Nodes (13): compilerOptions, noEmit, plugins, extends, include, ../../config/typescript/nextjs.json, next.config.ts, next-env.d.ts (+5 more)

### Community 47 - "Environment Schemas"
Cohesion: 0.22
Nodes (11): ApiEnvironment, apiEnvironmentSchema, baseServiceEnvironmentSchema, CrawlerEnvironment, crawlerEnvironmentSchema, loadApiEnvironment(), loadCrawlerEnvironment(), logLevelSchema (+3 more)

### Community 48 - "Min-Heap Priority Queue"
Cohesion: 0.23
Nodes (3): Comparator, MinHeap, selectTopK()

### Community 49 - "Levenshtein Fuzzy Matching"
Cohesion: 0.27
Nodes (7): defaultMaximumEditDistance(), levenshteinDistance(), correctQuerySpelling(), SpellCorrectionOptions, SpellCorrectionResult, unchanged(), VocabularyAccess

### Community 50 - "Snapshot Manager"
Cohesion: 0.25
Nodes (7): checksums(), isInside(), isNotFound(), SnapshotManager, SnapshotManifest, validateId(), walk()

### Community 52 - "Crawler Runtime Jobs"
Cohesion: 0.22
Nodes (9): ClaimedJob, environment, execute(), indexDocument(), logger, markFailed(), report(), SourceRow (+1 more)

### Community 53 - "Package TS Config"
Cohesion: 0.15
Nodes (12): compilerOptions, tsBuildInfoFile, exclude, extends, include, ../../config/typescript/nextjs.json, next.config.ts, next-env.d.ts (+4 more)

### Community 54 - "Benchmarks & Fixtures"
Cohesion: 0.19
Nodes (10): createSyntheticDocuments(), BenchmarkResult, Distribution, measure(), outputPath, percentile(), report, results (+2 more)

### Community 55 - "Crawler API Schemas"
Cohesion: 0.15
Nodes (12): CrawlConfigurationApi, crawlConfigurationSchema, CrawlJobIdParameters, crawlJobIdParametersSchema, CreateCrawlSourceApiRequest, createCrawlSourceSchema, domainSchema, httpUrlSchema (+4 more)

### Community 56 - "Core Entities & Schemas"
Cohesion: 0.18
Nodes (10): Document, documentSchema, entityIdSchema, Index, indexSchema, Project, projectSchema, BackgroundJobStatus (+2 more)

### Community 57 - "API Keys Page UI"
Cohesion: 0.23
Nodes (8): metadata, ApiKeyManager(), create(), load(), revoke(), showError(), ApiKeyView, scopes

### Community 58 - "Crawler Dashboard UI"
Cohesion: 0.30
Nodes (10): CrawlerDashboard(), crawl(), createSource(), refresh(), IndexManager(), createIndex(), createProject(), deleteIndex() (+2 more)

### Community 59 - "Search API Schemas"
Cohesion: 0.17
Nodes (11): AutocompleteApiRequest, autocompleteRequestSchema, fieldValueSchema, highlightOptionsSchema, IndexIdParameters, indexIdParametersSchema, scalarValueSchema, SearchApiRequest (+3 more)

### Community 60 - "Analytics Dashboard UI"
Cohesion: 0.20
Nodes (6): metadata, AnalyticsDashboard(), loadAnalytics(), ClickMetrics, Overview, QueryMetric

### Community 61 - "Root Layout & Icons"
Cohesion: 0.25
Nodes (7): metadata, Icon(), IconName, paths, MobileNavigation(), navigation, Sidebar()

### Community 62 - "Recommendations Page UI"
Cohesion: 0.20
Nodes (5): metadata, Mode, RecommendationPlayground(), recordInteraction(), RecommendationView

### Community 63 - "Settings Page UI"
Cohesion: 0.29
Nodes (5): ConnectionSettings(), publicEnvironment, publicEnvironmentSchema, ApiError, setSessionApiKey()

### Community 64 - "Search Algorithm Concepts"
Cohesion: 0.25
Nodes (11): BM25 Ranking, Fuzzy Matching, Inverted Index, Phrase Search, Top-K Heap, Trie Autocomplete, BM25 Defaults k1=1.2 b=0.75, @seekr/search-core (+3 more)

### Community 65 - "Architecture Decisions"
Cohesion: 0.18
Nodes (10): Dependency Direction Rule, No Hosted Services Decision, Single Active Writer Boundary, Root README, MIT License, Abhaysinh Vansadia, Seekr, pnpm + Turborepo (+2 more)

### Community 67 - "Build Output TS Config A"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, tsBuildInfoFile, extends, include, ../../config/typescript/node.json, src/**/*.ts (+1 more)

### Community 68 - "Crawler Types & Tests"
Cohesion: 0.38
Nodes (6): CrawlConfiguration, CrawledDocument, CrawlJobStatus, CrawlRequest, ExtractedPage, PageIndexSink

### Community 69 - "Build Output TS Config B"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, tsBuildInfoFile, extends, include, ../../config/typescript/node.json, src/**/*.ts (+1 more)

### Community 70 - "Node TS Config"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, types, extends, ./base.json, ES2023 (+1 more)

### Community 71 - "Composite TS Config A"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, outDir, rootDir, extends, include, ../../config/typescript/node.json, src/**/*.ts (+1 more)

### Community 72 - "TS Config C"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, tsBuildInfoFile, extends, include, ../../config/typescript/node.json, src/**/*.ts (+1 more)

### Community 73 - "Composite TS Config B"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, outDir, rootDir, extends, include, ../../config/typescript/node.json, src/**/*.ts (+1 more)

### Community 74 - "TS Config D"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, rootDir, tsBuildInfoFile, extends, include, ../../config/typescript/node.json, src/**/*.ts (+1 more)

### Community 75 - "Page Content Extraction"
Cohesion: 0.39
Nodes (7): CHROME_SELECTORS, compactBlocks(), extractPageContent(), normalizeInlineText(), normalizeWhitespace(), readStructuredData(), REMOVED_ELEMENTS

### Community 76 - "Link Discovery & URL Safety"
Cohesion: 0.39
Nodes (6): discoverPageLinks(), isAllowedDomain(), isPrivateNetworkAddress(), isPrivateNetworkUrl(), normalizeUrl(), PRIVATE_IPV4

### Community 77 - "Overview Dashboard UI"
Cohesion: 0.25
Nodes (4): AnalyticsOverview, CrawlJob, Health, OverviewDashboard()

### Community 78 - "Docs Search Example UI"
Cohesion: 0.31
Nodes (5): display(), DocsSearch(), escapeHtml(), Hit, Result

### Community 79 - "TS Config E"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, tsBuildInfoFile, extends, include, ../../config/typescript/node.json, src/**/*.ts

### Community 80 - "TS Config F"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, tsBuildInfoFile, extends, include, ../../config/typescript/node.json, src/**/*.ts

### Community 81 - "TS Config G"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, tsBuildInfoFile, extends, include, ../../config/typescript/node.json, src/**/*.ts

### Community 82 - "Synonym Map"
Cohesion: 0.36
Nodes (3): add(), SynonymMap, SynonymRule

### Community 83 - "Vitest Root Config"
Cohesion: 0.25
Nodes (7): vitest.config.ts, compilerOptions, noEmit, extends, files, ./config/typescript/node.json, references

### Community 84 - "Auth Hooks"
Cohesion: 0.38
Nodes (6): createAuthenticationHook(), createProjectAuthorizationHook(), fastify, FastifyRequest, requiredScope(), AuthenticatedApiKey

### Community 85 - "Index Detail Actions"
Cohesion: 0.67
Nodes (7): IndexDetail(), importDocuments(), load(), reindex(), removeDocument(), showError(), updateSchema()

### Community 86 - "Storage Architecture Docs"
Cohesion: 0.29
Nodes (7): Immutable Segments, Snapshots, Architecture Documentation, Audit Report, Docs Index, @seekr/tokenizer, Indexing Pipeline

### Community 87 - "API Key API Schemas"
Cohesion: 0.29
Nodes (6): apiKeyIdParametersSchema, ApiKeyScope, apiKeyScopeSchema, CreateApiKeyApiRequest, createApiKeyRequestSchema, listApiKeysQuerySchema

### Community 88 - "Recommendation API Schemas"
Cohesion: 0.29
Nodes (6): recommendationItemParametersSchema, RecommendationQuery, recommendationQuerySchema, recommendationUserParametersSchema, RecordInteractionApiRequest, recordInteractionRequestSchema

### Community 89 - "Security Concepts"
Cohesion: 0.33
Nodes (5): Scoped API Keys, Robots Policy, SSRF Protection, Crawler, Cheerio

### Community 90 - "Example Bootstrap Scripts"
Cohesion: 0.33
Nodes (5): bootstrap, createdKey, documents, seekr, suffix

### Community 92 - "Prettier Config"
Cohesion: 0.33
Nodes (5): plugins, printWidth, semi, singleQuote, trailingComma

### Community 93 - "Recommendation Concepts"
Cohesion: 0.60
Nodes (5): Collaborative Filtering, Content-Based Recommendation, Hybrid Recommendations, TF-IDF, @seekr/recommendation-core

### Community 94 - "Analytics API Schemas"
Cohesion: 0.40
Nodes (4): AnalyticsRangeQuery, analyticsRangeQuerySchema, ClickEventApiRequest, clickEventRequestSchema

### Community 95 - "Health Check Schemas"
Cohesion: 0.40
Nodes (4): DependencyStatus, dependencyStatusSchema, HealthResponse, healthResponseSchema

### Community 96 - "Seed Script"
Cohesion: 0.50
Nodes (3): client, documents, [indexId, sourceFile]

## Ambiguous Edges - Review These
- `Fastify API` → `Basic Example`  [AMBIGUOUS]
  examples/basic/README.md · relation: unknown

## Knowledge Gaps
- **532 isolated node(s):** `plugins`, `printWidth`, `semi`, `singleQuote`, `trailingComma` (+527 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Fastify API` and `Basic Example`?**
  _Edge tagged AMBIGUOUS (relation: related to) - confidence is low._
- **Why does `InMemoryIndexService` connect `In-Memory Index Service` to `Metrics Registry`, `API Keys & Auth`, `Fastify App Setup`, `API Route Tests`, `Cache & Server Bootstrap`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `CatalogStore` connect `Catalog Store` to `Metrics Registry`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `IndexManagementService` connect `Metrics Registry` to `API Keys & Auth`, `Fastify App Setup`, `Auth Hooks`, `Cache & Server Bootstrap`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `buildApp()` (e.g. with `.complete()` and `.start()`) actually correct?**
  _`buildApp()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `plugins`, `printWidth`, `semi` to the rest of the system?**
  _532 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Search Analytics Client` be split into smaller, more focused modules?**
  _Cohesion score 0.08683853459972862 - nodes in this community are weakly interconnected._