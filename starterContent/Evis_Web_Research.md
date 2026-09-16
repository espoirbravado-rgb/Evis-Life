# Evis — Web Search & Research Architecture

> **Status:** CORE CAPABILITY ARCHITECTURE
> **Role:** Define the complete architecture for web search, web retrieval, web research, provider management, API pools, fallback, quotas, context handling, verification, and external research delegation.
>
> **Related architectural documents:**
>
> * `Obligatory.md` → mandatory engineering rules.
> * `Foundation.md` → core Evis architecture.
> * `Working-Memory.md` → project working memory and reference-based context.
>
> This document is specifically responsible for the **Web Search / Web Research subsystem**.
>
> It must not redefine the entire Evis architecture.

---

# 1. Purpose

Web access must become a genuine Evis capability.

Evis must be able to determine:

```text
Does this request require web access?
        ↓
What type of web capability is required?
        ↓
Which provider can satisfy it?
        ↓
Is that provider available?
        ↓
Is it configured?
        ↓
Is its quota available?
        ↓
Is its use permitted?
        ↓
How should the request be executed?
        ↓
How should the result be verified?
```

The Web subsystem must therefore be treated as an independent runtime subsystem rather than a UI feature.

---

# 2. Fundamental Principle

The Web subsystem must not work like:

```text
User
 ↓
"search" detected
 ↓
hard-coded API
 ↓
result
```

It must work like:

```text
User Request
      ↓
Goal Understanding
      ↓
Capability Resolution
      ↓
Web Capability
      ↓
Provider Resolution
      ↓
Policy / Permission
      ↓
Execution Plan
      ↓
Web Provider
      ↓
Real Search
      ↓
Structured Results
      ↓
Evaluation / Verification
      ↓
Working Memory
      ↓
Model
      ↓
Response
```

The model must be able to reason about the search.

The runtime must control actual network access and provider execution.

---

# 3. Web Is a Capability Family

"Web Search" must not be treated as one indivisible operation.

The Web subsystem should expose multiple capabilities.

Initial capability family:

```text
web.search
web.open
web.fetch
web.extract
web.find
web.research
web.compare
web.verify
```

Potential future capabilities:

```text
web.crawl
web.sitemap
web.monitor
web.news
web.images
web.documents
web.archive
```

Only capabilities actually implemented and registered may be advertised as available.

---

# 4. Search vs Research

Evis must distinguish between a simple search and a research operation.

## Search

A search generally means:

```text
Find relevant information.
```

Example:

```text
"Find the official documentation for X."
```

Possible flow:

```text
query
 ↓
search provider
 ↓
results
 ↓
response
```

## Research

Research is a multi-step operation.

Example:

```text
"Compare the current free web search APIs and determine
which ones would be appropriate for Evis."
```

Possible flow:

```text
define research question
 ↓
search
 ↓
open sources
 ↓
extract information
 ↓
cross-check
 ↓
search again
 ↓
compare
 ↓
synthesize
 ↓
verify
 ↓
produce result
```

Research must therefore be capable of using the other Web capabilities recursively.

---

# 5. Web Provider Pool

Evis should support a pool of web providers rather than depending on a single API.

Conceptually:

```text
Web Provider Pool
│
├── Provider A
├── Provider B
├── Provider C
├── Provider D
└── Provider E
```

Each provider must be represented independently.

A provider may expose:

```text
search
open
fetch
extract
news
images
```

or only a subset.

---

# 6. Provider Abstraction

Every Web provider must expose a common runtime contract.

Conceptually:

```text
WebProvider
├── identity
├── capabilities
├── configuration
├── authentication
├── limits
├── quota
├── health
├── priority
├── cost
├── availability
└── execution methods
```

The exact interface may differ during implementation.

The important requirement is:

> Evis must not hard-code one provider's API directly into the Orchestrator.

---

# 7. Provider Examples

The architecture must support providers such as:

```text
Search API
Search engine API
News API
Web extraction API
Crawler API
Remote research provider
```

Specific providers should be added through the provider system.

The Web subsystem must not be architecturally tied to any particular company.

---

# 8. Provider Capability Matrix

Each provider must advertise what it actually supports.

Conceptually:

```text
                    search   open   fetch   extract   news
Provider A             ✓       ✓      ✓        ✓        -
Provider B             ✓       -      ✓        -        ✓
Provider C             ✓       ✓      -        ✓        -
```

The runtime should resolve:

```text
required capability
        ↓
compatible providers
```

rather than assuming that every provider supports everything.

---

# 9. Provider Selection

Provider selection must consider multiple factors.

Potential factors:

```text
capability compatibility
availability
configuration
authentication
quota
rate limits
latency
cost
provider priority
result quality
request type
network state
policy
```

The selection mechanism should be extensible.

Example:

```text
web.search
    ↓
Provider A
Provider B
Provider C
    ↓
filter unavailable providers
    ↓
filter incompatible providers
    ↓
filter unauthorized providers
    ↓
evaluate remaining providers
    ↓
select best candidate
```

---

# 10. Provider Priority

Providers may have configurable priorities.

Example:

```text
Provider A → priority 100
Provider B → priority 80
Provider C → priority 60
```

However, priority alone must never override capability compatibility or policy.

A provider with the highest priority cannot be selected if:

```text
it does not support the capability
```

or:

```text
it is unavailable
```

or:

```text
authentication is missing
```

or:

```text
policy prohibits its use
```

---

# 11. Quota Management

API quotas must be treated as runtime state.

Evis should be able to represent:

```text
remaining quota
quota limit
reset time
requests used
rate limit
provider status
```

Conceptually:

```text
Provider
    ↓
Quota Manager
    ↓
AVAILABLE
LIMITED
EXHAUSTED
UNKNOWN
```

The exact quota information depends on what the provider exposes.

Evis must not invent quota information.

---

# 12. Rate Limiting

Rate limits must be distinguished from total quota exhaustion.

```text
RATE_LIMITED
```

may mean:

```text
wait and retry
```

while:

```text
QUOTA_EXHAUSTED
```

may mean:

```text
use another provider
```

The provider layer should expose structured errors so the fallback system can make an informed decision.

---

# 13. Web Provider Errors

The Web subsystem should normalize provider errors.

Initial error categories:

```text
PROVIDER_UNAVAILABLE
NETWORK_ERROR
TIMEOUT
RATE_LIMITED
QUOTA_EXHAUSTED
AUTH_REQUIRED
AUTH_INVALID
UNSUPPORTED_CAPABILITY
BAD_REQUEST
PROVIDER_ERROR
POLICY_DENIED
NO_RESULTS
PARTIAL_RESULTS
```

Provider-specific errors may be retained as metadata.

The normalized error allows Evis to make provider-independent decisions.

---

# 14. Intelligent Fallback

Fallback must be capability-aware and error-aware.

Example:

```text
Request
 ↓
Provider A
 ↓
RATE_LIMITED
 ↓
Provider B
 ↓
SUCCESS
```

Another:

```text
Request
 ↓
Provider A
 ↓
UNSUPPORTED_CAPABILITY
 ↓
Provider B
 ↓
SUCCESS
```

But:

```text
Provider A
 ↓
POLICY_DENIED
```

must not automatically trigger another provider if the policy applies to the operation itself.

Similarly:

```text
AUTH_REQUIRED
```

may require user configuration rather than blind fallback.

---

# 15. Fallback Decision Model

Conceptually:

```text
Provider Error
      ↓
Classify Error
      ↓
Is fallback appropriate?
      │
 ┌────┴────┐
 │         │
 YES       NO
 │         │
Next       Report /
provider   request action
```

The fallback system must not blindly execute every available provider.

---

# 16. Provider Health

Evis should maintain provider health information.

Possible states:

```text
healthy
degraded
unavailable
unknown
authentication_required
quota_exhausted
```

Health information may influence provider selection.

A provider that repeatedly fails should not necessarily be selected again immediately.

---

# 17. Search Request

A search request must be represented structurally.

Conceptually:

```js
{
  capability: "web.search",
  query: "...",
  options: {
    language: "...",
    region: "...",
    freshness: "...",
    resultLimit: 10
  }
}
```

The actual schema must be defined by the Web Tool contract.

The model must not directly construct provider-specific HTTP requests unless the architecture explicitly permits it through a controlled provider interface.

---

# 18. Search Result

Search results must be normalized.

Conceptually:

```js
{
  title: "...",
  url: "...",
  snippet: "...",
  source: "...",
  publishedAt: "...",
  metadata: {}
}
```

Provider-specific response formats should be converted into a common representation.

This allows the research system to operate independently of the provider.

---

# 19. Result Provenance

Every useful web result should preserve provenance.

The system should know:

```text
which provider returned it
which query produced it
when it was retrieved
which URL it came from
```

Conceptually:

```text
Search Result
├── URL
├── provider
├── query
├── retrievedAt
└── metadata
```

This is important for verification and research reproducibility.

---

# 20. Source Identity

A URL should have a stable identity inside the research workspace.

Conceptually:

```text
source:S001
```

may represent:

```text
https://example.com/article
```

The workspace can then record:

```text
research:R001
    ↓
references
    ↓
source:S001
```

---

# 21. Web Open

Search results alone are not sufficient for serious research.

Evis must be able to open relevant sources.

Flow:

```text
search result
 ↓
web.open
 ↓
source content
 ↓
extract relevant information
```

The Open capability must be independent from the search provider when possible.

---

# 22. Web Fetch

Some research operations require retrieving a resource directly.

```text
web.fetch
```

must be treated as a distinct capability.

It may be used when:

```text
the URL is already known
```

without requiring a search operation.

---

# 23. Content Extraction

Raw webpages often contain:

```text
navigation
advertisements
scripts
styles
irrelevant content
```

The Web subsystem should therefore provide content extraction where supported.

Conceptually:

```text
Raw Page
 ↓
Parser / Extractor
 ↓
Relevant Document
```

The extraction system must preserve source identity.

---

# 24. Search Result ≠ Truth

A search result must never automatically be treated as verified truth.

The research pipeline should distinguish:

```text
found
```

from:

```text
verified
```

and:

```text
high confidence
```

Search ranking is not proof.

---

# 25. Research Verification

For important research tasks, Evis should be capable of cross-checking information.

Example:

```text
Claim
 ↓
Source A
 ↓
Source B
 ↓
Source C
 ↓
comparison
 ↓
confidence
```

The number of sources should depend on:

```text
importance
conflict
uncertainty
request requirements
```

Do not blindly search an arbitrary number of sources.

---

# 26. Research Plan

A research task should have a structured plan.

Conceptually:

```text
ResearchPlan
├── question
├── objectives
├── search queries
├── required capabilities
├── source requirements
├── verification requirements
├── constraints
└── completion criteria
```

Example:

```text
Question:
Which provider architecture is suitable for Evis web search?

Objectives:
- identify viable providers
- compare capabilities
- compare limits
- identify fallback possibilities
- verify current documentation

Sources:
official documentation preferred
```

---

# 27. Multi-Query Research

One research question may require several queries.

Example:

```text
Research Question
       ↓
Query 1
Query 2
Query 3
       ↓
Results
       ↓
Source selection
       ↓
Open
       ↓
Extract
       ↓
Compare
```

The model may generate additional queries when the current evidence is insufficient.

The runtime executes those searches through the Web capability.

---

# 28. Research Iteration

Research should be iterative.

Conceptually:

```text
SEARCH
 ↓
INSPECT
 ↓
IDENTIFY INFORMATION GAPS
 ↓
SEARCH AGAIN
 ↓
VERIFY
 ↓
SYNTHESIZE
```

The system must have a stopping condition.

It must not search indefinitely.

---

# 29. Research Budget

Research should have bounded resources.

Potential limits:

```text
maximum queries
maximum sources
maximum page retrievals
maximum execution time
maximum provider requests
maximum result size
```

These should be configurable.

The purpose is to prevent:

```text
research loop
 ↓
search
 ↓
search
 ↓
search
 ↓
quota exhausted
```

without meaningful progress.

---

# 30. Search Caching

Repeated searches may be cached when appropriate.

Conceptually:

```text
Query
 ↓
Cache
 ↓
Fresh result?
 ├── Yes → reuse
 └── No → provider
```

Cache validity should depend on the nature of the request.

For time-sensitive information, cached results may become invalid quickly.

For stable documentation, caching may be more useful.

---

# 31. Freshness

Search requests may specify freshness requirements.

Examples:

```text
current
today
this week
recent
any
```

The provider router should use providers capable of satisfying the requested freshness.

The system must not claim freshness that it cannot establish.

---

# 32. Web Search and Current Information

If a request requires current information, Evis should explicitly recognize that external retrieval is required.

Example:

```text
"What's the current API limit?"
```

should not automatically be answered from old stored knowledge.

Instead:

```text
current-information requirement
 ↓
web.search / web.open
 ↓
fresh evidence
```

---

# 33. Official Sources

For technical or provider-specific research, Evis should prefer authoritative sources where appropriate.

Example priority:

```text
official documentation
        ↓
official repository
        ↓
primary source
        ↓
reputable secondary source
        ↓
community source
```

The exact ranking depends on the research question.

Community sources can still be valuable for:

```text
experiences
bugs
practical issues
community consensus
```

but they should not automatically override primary documentation.

---

# 34. Source Diversity

When verification is important, Evis should avoid assuming that multiple pages necessarily represent independent evidence.

For example:

```text
Source A
Source B
Source C
```

may all copy the same information.

Research should consider source independence where meaningful.

---

# 35. Research Workspace

Web research must integrate with Working Memory.

Conceptually:

```text
Research
│
├── question
├── queries
├── sources
├── findings
├── claims
├── conflicts
├── decisions
└── conclusion
```

References should connect research objects.

Example:

```text
research:R001
    │
    ├── query:Q001
    ├── source:S001
    ├── source:S002
    ├── claim:C001
    └── finding:F001
```

---

# 36. Web Sources in Working Memory

Important sources should receive stable references.

Example:

```text
source:S014
```

A task may reference it:

```text
task:T023
    ↓
references
    ↓
source:S014
```

This means Evis can later return to the source without repeating the entire research process.

---

# 37. Research Claims

Important claims should be represented separately from raw sources.

Example:

```text
claim:C003

Statement:
Provider X supports capability Y.

Evidence:
source:S004
source:S009
```

This makes verification explicit.

---

# 38. Conflicting Sources

If sources disagree:

```text
Source A → value X
Source B → value Y
```

Evis must not silently select one.

The research state should represent:

```text
conflict detected
```

Then Evis can:

```text
search for additional evidence
compare source authority
check publication dates
report uncertainty
```

---

# 39. Web Research Result

A research result should distinguish:

```text
facts
sources
inferences
uncertainties
limitations
```

The model should not present an inference as if it were directly stated by a source.

---

# 40. External Research Delegation

If Evis cannot perform a required research operation locally, it may eventually delegate to an external AI or remote research agent.

Conceptually:

```text
Evis
 ↓
Research Capability
 ↓
Provider Resolution
 ↓
Local provider unavailable?
 ↓
Delegation Provider
 ↓
External Agent
```

The external system must be treated as a provider/agent, not as a hidden shortcut.

---

# 41. Delegation Contract

A remote research request should contain structured information.

Conceptually:

```text
{
  task,
  researchQuestion,
  context,
  constraints,
  requiredCapabilities,
  expectedOutput,
  sourceRequirements,
  verificationRequirements
}
```

The response should contain:

```text
{
  success,
  findings,
  sources,
  claims,
  uncertainties,
  metadata,
  errors
}
```

The exact protocol must be defined during implementation.

---

# 42. External Data Policy

Before sending information externally, Evis must evaluate policy.

Potential questions:

```text
Is external transmission allowed?
What data is being sent?
Does it contain private information?
Is the provider configured?
Does the user need confirmation?
Is the service paid?
```

The Web subsystem must not bypass the Policy Engine.

---

# 43. No Hidden Provider

Evis must never silently send user/project information to an external provider merely because a local provider failed.

Fallback is not permission.

The sequence must remain:

```text
provider failure
 ↓
candidate provider
 ↓
policy check
 ↓
permission
 ↓
execution
```

---

# 44. Web Tool Boundary

The Web Tool should be the controlled execution boundary for web operations.

Conceptually:

```text
Web Tool
├── search()
├── open()
├── fetch()
├── extract()
└── ...
```

The tool communicates with providers.

The model should not directly control arbitrary network requests outside this boundary.

---

# 45. Search Provider vs Web Tool

These must remain separate.

```text
Web Tool
    ↓
Provider Adapter
    ↓
Provider API
```

The Web Tool defines what Evis wants to do.

The provider adapter translates that operation into a provider-specific API request.

This allows:

```text
Provider A
```

to be replaced by:

```text
Provider B
```

without rewriting the research system.

---

# 46. Provider Adapter

Each provider should have an adapter responsible for translating the common contract into the provider's API.

Conceptually:

```text
Common Search Request
        ↓
Provider Adapter
        ↓
Provider-specific request
        ↓
Provider API
        ↓
Provider-specific response
        ↓
Normalized Search Result
```

Provider-specific implementation details must remain inside the adapter.

---

# 47. API Configuration

Provider configuration must be externalized.

Potential configuration:

```text
provider
api endpoint
API key
region
limits
priority
enabled state
```

Secrets must not be hard-coded into source code.

---

# 48. Provider Activation

A provider may be:

```text
installed
configured
enabled
disabled
available
unavailable
```

These states must not be conflated.

Example:

```text
Provider exists
but API key is missing
```

means:

```text
not-configured
```

not:

```text
working
```

---

# 49. Dynamic Provider Discovery

Where provider APIs or local configuration allow discovery, Evis should be able to discover available providers dynamically.

The runtime should not require every provider to be manually hard-coded into the Orchestrator.

Provider registration should be modular.

---

# 50. Local vs Remote Web Providers

Evis should distinguish:

```text
local capability
```

from:

```text
remote capability
```

For Web Search, most providers may naturally be remote.

The policy system must therefore understand network access as an explicit capability/permission.

---

# 51. Offline Behavior

When Evis is offline:

```text
network providers
 ↓
unavailable
```

The system must not fake search results.

It may:

```text
use valid cache
use local knowledge
inform user that fresh web access is unavailable
```

depending on the request.

For a request explicitly requiring current web information:

```text
no network
 ↓
honest failure
```

---

# 52. Search Cache vs Knowledge

Cached web results must not automatically become permanent knowledge.

Distinguish:

```text
Web Cache
```

from:

```text
Knowledge
```

A cached page may expire.

Knowledge may intentionally persist.

Promotion should be explicit or governed by a defined policy.

---

# 53. Web Result Lifecycle

A web result may follow:

```text
REQUESTED
 ↓
RETRIEVED
 ↓
PARSED
 ↓
SELECTED
 ↓
VERIFIED
 ↓
USED
 ↓
CACHED / ARCHIVED / EXPIRED
```

Not every result must pass through every state.

---

# 54. Search Result Ranking

Evis may rank search results based on:

```text
provider ranking
relevance
freshness
source authority
query match
duplicate detection
research requirements
```

Ranking should remain separate from retrieval.

---

# 55. Duplicate Sources

Different providers may return the same URL.

The system should detect duplicates where possible.

Example:

```text
Provider A → example.com/article
Provider B → example.com/article
```

This should not automatically count as two independent sources.

---

# 56. Research Deduplication

Research should avoid repeatedly retrieving identical resources unless freshness or verification requires it.

The workspace should be able to recognize:

```text
already retrieved
already analyzed
already verified
```

through references and metadata.

---

# 57. Search Sessions

A research operation may have its own search session.

Conceptually:

```text
Search Session
├── objective
├── queries
├── providers
├── results
├── sources
├── findings
└── state
```

This session should be linked to the current task/project when relevant.

---

# 58. Web Search and User Conversations

A simple search should not automatically create a massive research workspace.

The subsystem should scale according to task complexity.

```text
Simple query
 ↓
search
 ↓
result
```

while:

```text
Complex research
 ↓
research workspace
 ↓
multiple queries
 ↓
sources
 ↓
verification
 ↓
final synthesis
```

---

# 59. Web Search and Model Context

The model should not receive every raw search result indefinitely.

Instead:

```text
Search Results
 ↓
Selection
 ↓
Relevant Sources
 ↓
Extracted Information
 ↓
Context
```

The Working Memory system can retain source references outside the active model context.

---

# 60. Web Research and Working Memory Navigation

A complex research task may look like:

```text
Research
│
├── Question
│
├── Query A
│   ├── Source A1
│   └── Source A2
│
├── Query B
│   ├── Source B1
│   └── Source B2
│
├── Claim C1
│   ├── A1
│   └── B2
│
└── Conclusion
```

Evis can navigate:

```text
Conclusion
 ↑
Claim
 ↑
Source
 ↑
Query
 ↑
Research Question
```

This is the same reference-based working memory mechanism used by project execution.

---

# 61. Search Verification Before Response

For research tasks, the final response should be generated only after the research state reaches an appropriate completion condition.

Conceptually:

```text
research
 ↓
evidence
 ↓
verification
 ↓
synthesis
 ↓
response
```

The exact verification threshold depends on the task.

---

# 62. Current Information Verification

For time-sensitive questions, Evis should retain:

```text
retrievedAt
publishedAt
source
```

where available.

This prevents the system from presenting old information as current.

---

# 63. Research Completion Criteria

A research operation may be considered complete when:

```text
research question addressed
required capabilities executed
sufficient evidence collected
important conflicts resolved or reported
sources preserved
limitations identified
final synthesis possible
```

"Many search results were returned" is not a completion criterion.

---

# 64. Failure Handling

If search fails:

```text
do not invent results
```

If a provider fails:

```text
attempt valid fallback
```

If all providers fail:

```text
report web capability unavailable
```

If sources conflict:

```text
report conflict
```

If evidence is insufficient:

```text
report uncertainty
```

---

# 65. Security

Web access introduces network risk.

The subsystem must therefore integrate with the Policy Engine for:

```text
network access
external API usage
external AI delegation
sending project context
sending files
retrieving remote resources
```

The Web Tool must not independently define authorization.

---

# 66. Secrets

API credentials must:

```text
never be hard-coded
never be committed
never be exposed to the model unnecessarily
never be included in ordinary logs
```

Provider adapters should obtain credentials through the secure configuration mechanism.

---

# 67. Observability

The Web subsystem should record enough metadata to understand what happened.

Useful information:

```text
request ID
provider
capability
query
timestamp
latency
result count
error
fallback
quota state
```

Sensitive data must not be logged unnecessarily.

---

# 68. Cost Awareness

Some providers may be:

```text
free
quota-limited
paid
```

The provider router should eventually understand cost information.

A free provider with sufficient quota may be preferred for an ordinary request.

A paid provider may require:

```text
policy
configuration
user permission
```

depending on the system's settings.

---

# 69. Provider Pool Strategy

A mature Web subsystem may maintain:

```text
PRIMARY
SECONDARY
TERTIARY
SPECIALIZED
DELEGATION
```

providers.

Example:

```text
Normal Search
 ↓
Primary Search API
 ↓
fallback
 ↓
Secondary Search API
 ↓
fallback
 ↓
Specialized provider
 ↓
fallback
 ↓
Remote Research Agent
```

This is an example of routing, not a fixed provider list.

---

# 70. Capability-Based Fallback

Fallback must remain capability-based.

For example:

```text
web.search
```

may have:

```text
Provider A
Provider B
Provider C
```

while:

```text
web.extract
```

may have:

```text
Provider B
Provider D
```

The fallback pool must therefore be constructed per capability.

---

# 71. Provider Selection Must Not Leak Into Skills

A Web Research Skill should not contain:

```text
"use Provider X"
```

as its fundamental implementation.

Instead:

```text
Skill
 ↓
requires web.search
 ↓
Capability Resolver
 ↓
Provider Resolver
```

This keeps skills portable.

---

# 72. Web Skill

A Web Research Skill may provide:

```text
research methodology
source evaluation
query refinement
verification strategy
citation strategy
```

It does not itself perform network access.

Network access belongs to the Web Tool/provider system.

---

# 73. Example: Simple Search

User:

```text
Find the official documentation for X.
```

Runtime:

```text
USER REQUEST
 ↓
GOAL
 ↓
web.search
 ↓
Provider Resolver
 ↓
Web Tool
 ↓
Provider API
 ↓
Search Results
 ↓
select official result
 ↓
web.open
 ↓
result
 ↓
MODEL
 ↓
response
```

---

# 74. Example: Complex Research

User:

```text
Research the best architecture for Evis web search.
```

Runtime:

```text
USER REQUEST
 ↓
RESEARCH GOAL
 ↓
web.research
 ↓
Research Plan
 ↓
Query generation
 ↓
web.search
 ↓
Source selection
 ↓
web.open
 ↓
Extraction
 ↓
Evidence collection
 ↓
Working Memory
 ↓
Identify gaps
 ↓
Additional searches
 ↓
Cross-check
 ↓
Synthesis
 ↓
Verification
 ↓
Final response
```

---

# 75. Example: Provider Failure

```text
web.search
 ↓
Provider A
 ↓
QUOTA_EXHAUSTED
 ↓
Provider Router
 ↓
Provider B
 ↓
SUCCESS
```

The user should generally receive the result, not an unnecessary internal provider error.

The runtime should retain appropriate execution metadata for observability.

---

# 76. Example: All Providers Unavailable

```text
web.search
 ↓
Provider A → QUOTA_EXHAUSTED
Provider B → NETWORK_ERROR
Provider C → AUTH_REQUIRED
 ↓
No valid provider
 ↓
Web capability unavailable
```

The response must be honest.

No fabricated search result should be generated.

---

# 77. Example: External Delegation

```text
web.research
 ↓
local providers unavailable
 ↓
delegation policy
 ↓
external research provider available
 ↓
user/project context evaluated
 ↓
delegation request
 ↓
remote result
 ↓
validate result
 ↓
working memory
 ↓
model
```

External delegation is a provider resolution outcome, not a hidden emergency shortcut.

---

# 78. Web Research State Machine

Conceptually:

```text
IDLE
 ↓
PLANNING
 ↓
SEARCHING
 ↓
RETRIEVING
 ↓
ANALYZING
 ↓
VERIFYING
 ↓
SYNTHESIZING
 ↓
COMPLETED
```

Possible interruption states:

```text
PAUSED
BLOCKED
FAILED
WAITING_FOR_PERMISSION
WAITING_FOR_CONFIGURATION
```

---

# 79. Research Pause

A long research operation may be paused.

Its state should be stored through Working Memory.

Example:

```text
research:R004
status: paused
currentStep: verification
nextAction: inspect source:S014
```

When resumed:

```text
load research state
 ↓
resolve references
 ↓
reconstruct context
 ↓
continue
```

---

# 80. Search Session Cleanup

Temporary search data should not accumulate forever.

After research completion:

```text
temporary provider state
temporary raw responses
temporary execution data
```

may be released.

Important information may remain:

```text
sources
findings
claims
final conclusion
project-relevant knowledge
```

This follows the same lifecycle principle as Working Memory.

---

# 81. Testing Strategy

The Web subsystem must be tested independently and end-to-end.

### Provider Adapter Test

```text
common request
→ provider adapter
→ normalized result
```

### Capability Test

```text
web.search
→ compatible provider
```

### Fallback Test

```text
Provider A fails
→ Provider B selected
```

### Quota Test

```text
Provider A quota exhausted
→ fallback
```

### Authentication Test

```text
Provider requires authentication
→ configuration state
```

### Permission Test

```text
network access denied
→ request blocked
```

### Offline Test

```text
network unavailable
→ honest failure / valid cache
```

### Search Test

```text
query
→ real search
→ real results
```

### Open Test

```text
URL
→ real page
→ extracted content
```

### Research Test

```text
question
→ multiple searches
→ source retrieval
→ verification
→ final result
```

### Resume Test

```text
research
→ checkpoint
→ application restart
→ resume
```

---

# 82. No Simulated Web Search

The following are explicitly invalid as the final implementation:

```text
fake search results
hard-coded search results
setTimeout pretending to search
prewritten provider responses
regex detecting "search"
UI-only search
"Web Search" button without runtime integration
random URLs presented as search results
fake quota values
fake provider availability
```

A search feature is complete only when an actual provider has performed the operation.

---

# 83. No Single-Provider Architecture

The following architecture must be avoided:

```text
Orchestrator
 ↓
ProviderX
 ↓
API
```

because replacing ProviderX would require changing the core.

Preferred:

```text
Orchestrator
 ↓
Capability
 ↓
Provider Resolver
 ↓
Provider Adapter
 ↓
Provider
```

---

# 84. No Provider-Specific Research Logic

Avoid:

```text
if provider === "X":
   special research behavior
```

inside the research engine.

Provider-specific behavior belongs inside the provider adapter or provider capability declaration.

The research engine should operate on normalized capabilities and results.

---

# 85. No Blind Fallback

Avoid:

```text
try everything until something responds
```

The router must understand:

```text
capability
provider compatibility
error type
policy
quota
configuration
```

before selecting the next provider.

---

# 86. No Hidden Network Access

No component may silently perform arbitrary network access outside the Web Tool/provider boundary.

The runtime must know:

```text
what network operation is being performed
which provider is used
why it is required
whether it is permitted
```

---

# 87. No Research Without Provenance

Important research conclusions must be traceable to their sources.

At minimum:

```text
claim
 ↓
source reference
```

For complex research:

```text
claim
 ↓
evidence
 ↓
source
 ↓
URL
 ↓
retrieval metadata
```

---

# 88. Initial Implementation Order

The Web subsystem should be implemented in this order.

## Phase 1 — Audit

Inspect existing:

```text
Web UI
search routes
API routes
provider code
HTTP clients
configuration
mock data
fake search logic
```

Determine what is real and what is simulation.

---

## Phase 2 — Define Contracts

Define:

```text
WebCapability
WebProvider
ProviderAdapter
SearchRequest
SearchResult
WebDocument
ResearchPlan
ResearchState
ResearchResult
WebError
```

---

## Phase 3 — Provider Registry

Implement provider discovery and registration.

---

## Phase 4 — Provider Configuration

Implement:

```text
credentials
enabled state
priority
capability declaration
limits
```

---

## Phase 5 — Web Tool

Create the real execution boundary:

```text
Web Tool
 ↓
Provider Adapter
 ↓
Real Provider
```

---

## Phase 6 — Search

Implement:

```text
web.search
```

end-to-end with at least one genuine provider.

---

## Phase 7 — Open / Fetch

Implement:

```text
web.open
web.fetch
```

where supported.

---

## Phase 8 — Provider Fallback

Implement structured fallback based on:

```text
capability
availability
error
quota
policy
```

---

## Phase 9 — Result Normalization

Ensure different providers produce a common result format.

---

## Phase 10 — Working Memory Integration

Connect:

```text
queries
sources
findings
claims
research state
```

to the reference-based workspace.

---

## Phase 11 — Research Engine

Implement:

```text
research planning
query iteration
source retrieval
analysis
verification
synthesis
```

---

## Phase 12 — External Delegation

Only after local Web architecture is stable, implement remote research delegation.

---

## Phase 13 — UI

Expose:

```text
providers
status
search
research
progress
errors
sources
```

through the existing application architecture.

The UI must reflect actual runtime state.

---

# 89. First Vertical Slice

The first complete Web vertical slice should be:

```text
User
 ↓
"Search for X"
 ↓
Model / Orchestrator
 ↓
web.search
 ↓
Provider Resolver
 ↓
Web Tool
 ↓
Provider Adapter
 ↓
Real Search API
 ↓
Real Search Results
 ↓
Normalized Results
 ↓
Model
 ↓
Response
```

Only after this works should the provider pool and advanced research features be expanded.

---

# 90. Second Vertical Slice

The second slice should be:

```text
User
 ↓
"Research X"
 ↓
Research capability
 ↓
Research plan
 ↓
Search
 ↓
Open
 ↓
Extract
 ↓
Cross-check
 ↓
Working Memory
 ↓
Synthesis
 ↓
Response
```

---

# 91. Definition of Done

The Web Search subsystem is not complete because:

```text
a search box exists
```

or:

```text
an API endpoint exists
```

or:

```text
a provider name appears in settings
```

It is complete when:

```text
[ ] web.search is a real registered capability.
[ ] Web Tool exists as a real execution boundary.
[ ] Providers are independently represented.
[ ] Provider adapters isolate provider-specific APIs.
[ ] Provider capabilities are declared.
[ ] Provider availability is tracked.
[ ] Provider configuration is explicit.
[ ] Quota/rate-limit state is represented where available.
[ ] Provider errors are normalized.
[ ] Fallback is capability-aware.
[ ] Fallback is error-aware.
[ ] Network access passes through policy.
[ ] Search requests reach a real provider.
[ ] Search results are real.
[ ] Results are normalized.
[ ] Source provenance is retained.
[ ] web.open/web.fetch work where implemented.
[ ] Research can perform multiple operations.
[ ] Research can identify information gaps.
[ ] Research can perform additional searches.
[ ] Important sources are referenceable.
[ ] Important claims can reference evidence.
[ ] Conflicting evidence is represented.
[ ] Working Memory can preserve research state.
[ ] Long research can be paused and resumed.
[ ] Offline behavior is honest.
[ ] No fake results exist.
[ ] No regex-based search router controls the feature.
[ ] No single provider is hard-coded into the core.
[ ] UI reflects actual provider/runtime state.
```

---

# 92. Final Architecture

The intended architecture is:

```text
                           WEB SUBSYSTEM
                                │
                         ┌──────┴──────┐
                         │ Web Tool    │
                         └──────┬──────┘
                                │
                       Provider Resolver
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
             Provider A     Provider B     Provider C
                 │              │              │
             Adapter A      Adapter B      Adapter C
                 │              │              │
                 └──────────────┼──────────────┘
                                │
                         Normalized Results
                                │
                    ┌───────────┴───────────┐
                    │                       │
                Search                    Research
                    │                       │
                    │              ┌────────┴────────┐
                    │              │                 │
                    │           Sources           Findings
                    │              │                 │
                    └──────────────┼─────────────────┘
                                   │
                            Working Memory
                                   │
                            Reference Graph
                                   │
                            Context Manager
                                   │
                                  Model
```

---

# 93. Complete Request Flow

For a simple search:

```text
USER
 ↓
REQUEST
 ↓
GOAL
 ↓
web.search
 ↓
PROVIDER RESOLUTION
 ↓
POLICY
 ↓
WEB TOOL
 ↓
PROVIDER ADAPTER
 ↓
REAL API
 ↓
NORMALIZED RESULTS
 ↓
MODEL
 ↓
RESPONSE
```

For complex research:

```text
USER
 ↓
RESEARCH GOAL
 ↓
RESEARCH PLAN
 ↓
CAPABILITY RESOLUTION
 ↓
PROVIDER RESOLUTION
 ↓
POLICY
 ↓
SEARCH
 ↓
SOURCE SELECTION
 ↓
OPEN / FETCH
 ↓
EXTRACTION
 ↓
WORKING MEMORY
 ↓
EVIDENCE ANALYSIS
 ↓
IDENTIFY GAPS
 ↓
ADDITIONAL SEARCH
 ↓
CROSS-CHECK
 ↓
VERIFICATION
 ↓
SYNTHESIS
 ↓
MODEL
 ↓
FINAL RESPONSE
```

---

# 94. Final Principle

The Web subsystem must not be:

```text
"an API call that searches the Internet."
```

It must be:

```text
a capability-driven research infrastructure
```

in which Evis can dynamically determine:

```text
what it needs to know
        ↓
what web capability is required
        ↓
which provider can perform it
        ↓
whether that provider is available
        ↓
whether it is permitted
        ↓
whether another provider is needed
        ↓
what evidence was obtained
        ↓
what remains uncertain
        ↓
what should be retained in Working Memory
```

The provider is replaceable.

The API is replaceable.

The model is replaceable.

The skill is replaceable.

The research strategy can evolve.

The **Web capability contract and runtime boundary remain stable**.

> **Evis must not depend on one search API. Evis must own the capability of web research and dynamically select the resources capable of providing it.**

The ultimate objective is:

```text
                    WEB KNOWLEDGE
                         │
                         ↓
                  REAL RETRIEVAL
                         │
                         ↓
                  STRUCTURED EVIDENCE
                         │
                         ↓
                 REFERENCEABLE MEMORY
                         │
                         ↓
                    REASONING
                         │
                         ↓
                    VERIFIED
                    RESPONSE
```

This is the Web Research subsystem of Evis.
