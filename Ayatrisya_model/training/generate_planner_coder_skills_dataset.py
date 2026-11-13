from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "data" / "generated"
PROVENANCE = "ametesx_synthetic_planner_coder_skills_curated_dataset"
LICENSE_STATUS = "proprietary_ametesx_research_dataset"

# ---------------------------------------------------------------------------
# Training Families: Planner, Coder, and Technical Skills
# ---------------------------------------------------------------------------
PLANNER_CODER_TRAIN_FAMILIES: list[tuple[str, str, list[tuple[str, str]]]] = [
    # 1. PLANNER AGENT: Architecture & System Decomposition
    ("planner_agent", "Decompose the software project into core architectural components.", [
        (
            "Build a real-time collaborative code editor.",
            "1. Client UI: React Monaco editor with operational transformation (OT/CRDT).\n2. WebSocket Gateway: Stateful connection pool with heartbeat.\n3. Session Broker: Redis pub/sub for room synchronization.\n4. Storage: PostgreSQL for files; S3 for snapshots.\n5. Auth: JWT with OAuth2 providers.",
        ),
        (
            "Design an e-commerce checkout workflow.",
            "1. Cart Service: Redis-backed session cart with stock validation.\n2. Order Service: Transactional state machine (Pending -> Paid -> Fulfilled).\n3. Payment Gateway: Idempotent provider webhook handler.\n4. Inventory Service: Distributed lock on SKU allocation.\n5. Notification: Async queue for email and SMS receipt dispatch.",
        ),
        (
            "Architect a scalable web analytics pipeline.",
            "1. Ingestion Endpoint: Ultra-low latency edge collector with event validation.\n2. Message Stream: Apache Kafka / RabbitMQ partitioned by site ID.\n3. Stream Processor: Flink / Spark for aggregation.\n4. Analytical DB: ClickHouse / BigQuery for OLAP queries.\n5. Dashboard API: Cached GraphQL endpoints.",
        ),
        (
            "Plan a task queue scheduling service.",
            "1. Dispatcher: Cron parser with next-execution calculation.\n2. Task Registry: Persistent storage with job definitions.\n3. Worker Pool: Autoscaling worker nodes consuming queues.\n4. State Monitor: Heartbeat detection and retry exponential backoff.\n5. Dead-Letter Queue: Failure quarantine with alert triggers.",
        ),
    ]),

    # 2. PLANNER AGENT: Milestone & Phase Planning
    ("planner_agent", "Create a multi-phase implementation roadmap with milestones.", [
        (
            "Launch a multi-tenant SaaS dashboard.",
            "Phase 1: Foundation (Data models, tenant isolation, authentication).\nPhase 2: Core Metrics (Aggregation queries, chart visualizers, filters).\nPhase 3: Team Collaboration (Role-based access control, audit logs, invites).\nPhase 4: Billing & Production (Stripe checkout, telemetry, rate limiting).",
        ),
        (
            "Develop an automated test automation suite.",
            "Phase 1: Unit Test Harness (Coverage baseline, CI pipeline hooks).\nPhase 2: API Contract Tests (Mock server, schema validation).\nPhase 3: E2E Integration (Playwright smoke tests across critical user journeys).\nPhase 4: Performance & Load Tests (k6 stress testing, latency budgets).",
        ),
        (
            "Migrate a monolithic backend to microservices.",
            "Phase 1: Domain Boundary Discovery (Event storming, shared database analysis).\nPhase 2: Strangler Fig Pattern (Extract read-only services behind an API gateway).\nPhase 3: Decouple Data (Separate database schemas, asynchronous event replication).\nPhase 4: Cutover & Monolith Decommission.",
        ),
        (
            "Build an interactive quiz and examination system.",
            "Phase 1: Question Engine (JSON schemas, question validators, option mapping).\nPhase 2: Examination Engine (Timer, autosave, cheat-proof server-side answer withholding).\nPhase 3: Grading & Scoring (Server-side grading, topic performance breakdowns).\nPhase 4: Analytics (Progress history, weak-area detection, adaptive practice).",
        ),
    ]),

    # 3. PLANNER AGENT: Risk Analysis & Mitigation
    ("planner_agent", "Identify critical engineering risks and provide mitigations.", [
        (
            "Deploying high-frequency financial ticker ingestion.",
            "Risk 1: Ingestion buffer overflow -> Mitigation: Backpressure with RingBuffers and Kafka partitioning.\nRisk 2: Clock drift between nodes -> Mitigation: PTP/NTP synchronization and monotonic sequence numbers.\nRisk 3: Memory leaks under sustained peak load -> Mitigation: Strict zero-copy allocations and heap profiling.",
        ),
        (
            "Storing end-user sensitive personal data (PII).",
            "Risk 1: Unauthorized database access -> Mitigation: AES-256 field-level encryption with AWS KMS.\nRisk 2: Token exposure in client logs -> Mitigation: Strict log redaction masks and HttpOnly cookies.\nRisk 3: GDPR/CCPA non-compliance -> Mitigation: Cryptographic shredding and automated data deletion pipelines.",
        ),
        (
            "Introducing third-party payment integration.",
            "Risk 1: Duplicate payment charge -> Mitigation: Idempotency keys on every transaction request.\nRisk 2: Dropped webhook notifications -> Mitigation: Webhook signature verification and reconciliation worker.\nRisk 3: Provider API outage -> Mitigation: Circuit breaker with graceful user-facing retry states.",
        ),
        (
            "Running unsandboxed user code.",
            "Risk 1: Host privilege escalation -> Mitigation: gVisor / Firecracker microVM with seccomp-bpf filters.\nRisk 2: Resource exhaustion (fork bombs) -> Mitigation: Linux cgroups v2 memory and CPU quotas.\nRisk 3: SSRF and network access -> Mitigation: Isolated network namespace with zero outbound routes.",
        ),
    ]),

    # 4. CODER AGENT: Clean Algorithm & Data Structures
    ("coder_agent", "Implement the requested algorithm in clean, idiomatic Python with error handling.", [
        (
            "Write a function to find the two numbers in a list that add up to a target sum.",
            "def two_sum(nums: list[int], target: int) -> tuple[int, int]:\n    seen: dict[int, int] = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return (seen[complement], i)\n        seen[num] = i\n    raise ValueError('No two sum solution found')",
        ),
        (
            "Implement an LRU Cache with O(1) get and put.",
            "from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity: int):\n        if capacity <= 0:\n            raise ValueError('Capacity must be positive')\n        self.capacity = capacity\n        self.cache: OrderedDict[str, any] = OrderedDict()\n\n    def get(self, key: str) -> any:\n        if key not in self.cache:\n            return None\n        self.cache.move_to_end(key)\n        return self.cache[key]\n\n    def put(self, key: str, value: any) -> None:\n        if key in self.cache:\n            self.cache.move_to_end(key)\n        self.cache[key] = value\n        if len(self.cache) > self.capacity:\n            self.cache.popitem(last=False)",
        ),
        (
            "Implement binary search on a sorted list.",
            "def binary_search(arr: list[int], target: int) -> int:\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1",
        ),
        (
            "Write a function to merge overlapping intervals.",
            "def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:\n    if not intervals:\n        return []\n    sorted_intervals = sorted(intervals, key=lambda x: x[0])\n    merged = [sorted_intervals[0]]\n    for current in sorted_intervals[1:]:\n        prev = merged[-1]\n        if current[0] <= prev[1]:\n            prev[1] = max(prev[1], current[1])\n        else:\n            merged.append(current)\n    return merged",
        ),
    ]),

    # 5. CODER AGENT: TypeScript Clean Code & Type Safety
    ("coder_agent", "Write a robust TypeScript implementation with strict typing and input validation.", [
        (
            "Create a type-safe Result type pattern for error handling.",
            "export type Result<T, E = Error> =\n  | { ok: true; value: T }\n  | { ok: false; error: E };\n\nexport function ok<T>(value: T): Result<T, never> {\n  return { ok: true, value };\n}\n\nexport function err<E>(error: E): Result<never, E> {\n  return { ok: false, error };\n}",
        ),
        (
            "Implement a debounce utility function.",
            "export function debounce<T extends (...args: any[]) => void>(\n  fn: T,\n  delayMs: number\n): (...args: Parameters<T>) => void {\n  let timer: ReturnType<typeof setTimeout> | undefined;\n  return (...args: Parameters<T>) => {\n    if (timer !== undefined) clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delayMs);\n  };\n}",
        ),
        (
            "Write a generic retry function with exponential backoff.",
            "export async function retryWithBackoff<T>(\n  task: () => Promise<T>,\n  maxRetries = 3,\n  initialDelayMs = 200\n): Promise<T> {\n  let delay = initialDelayMs;\n  for (let attempt = 1; attempt <= maxRetries; attempt++) {\n    try {\n      return await task();\n    } catch (error) {\n      if (attempt === maxRetries) throw error;\n      await new Promise(r => setTimeout(r, delay));\n      delay *= 2;\n    }\n  }\n  throw new Error('Unreachable');\n}",
        ),
        (
            "Write a function to deeply freeze an object in TypeScript.",
            "export function deepFreeze<T extends object>(obj: T): Readonly<T> {\n  Object.freeze(obj);\n  for (const key of Object.getOwnPropertyNames(obj)) {\n    const value = (obj as any)[key];\n    if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {\n      deepFreeze(value);\n    }\n  }\n  return obj as Readonly<T>;\n}",
        ),
    ]),

    # 6. CODER AGENT: Bug Fixing & Refactoring
    ("coder_agent", "Analyze the buggy code, explain the root cause, and provide the fixed version.", [
        (
            "Bug: useEffect with missing dependencies causes stale closure.",
            "Root Cause: The effect function references variables without listing them in the dependency array, causing it to capture stale initial state.\nFix: Add all referenced variables to the dependency array or use a functional state updater like setCount(prev => prev + 1).",
        ),
        (
            "Bug: Node.js unhandled promise rejection in an asynchronous express route.",
            "Root Cause: Standard Express 4 routes do not automatically catch rejected promises, leading to server process crashes.\nFix: Wrap async handlers with try/catch calling next(err), or use an async-handler wrapper utility.",
        ),
        (
            "Bug: Memory leak in event listener registration inside a loop.",
            "Root Cause: Attaching new event listeners inside a repetitive cycle without removing previous listeners leads to memory exhaustion.\nFix: Register the listener once outside the loop or remove it using removeEventListener / EventEmitter.off() upon cleanup.",
        ),
        (
            "Bug: Race condition in bank balance update (Read-Modify-Write).",
            "Root Cause: Concurrent transactions read the balance before the first write commits, overwriting balance decrements.\nFix: Use database transactions with pessimistic locking (SELECT ... FOR UPDATE) or atomic updates (UPDATE accounts SET balance = balance - 100 WHERE id = 1 AND balance >= 100).",
        ),
    ]),

    # 7. SKILL: Database & SQL Architecture
    ("skill_database", "Write production-ready SQL with index optimization and transaction safety.", [
        (
            "Design a schema for user accounts and authentication sessions.",
            "CREATE TABLE users (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    email VARCHAR(255) UNIQUE NOT NULL,\n    password_hash VARCHAR(255) NOT NULL,\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);\n\nCREATE TABLE user_sessions (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    user_id UUID REFERENCES users(id) ON DELETE CASCADE,\n    session_token VARCHAR(64) UNIQUE NOT NULL,\n    expires_at TIMESTAMPTZ NOT NULL,\n    created_at TIMESTAMPTZ DEFAULT NOW()\n);\nCREATE INDEX idx_sessions_user_id ON user_sessions(user_id);\nCREATE INDEX idx_sessions_token ON user_sessions(session_token);",
        ),
        (
            "Write a query to calculate month-over-month revenue growth.",
            "WITH monthly_revenue AS (\n    SELECT\n        DATE_TRUNC('month', created_at) AS revenue_month,\n        SUM(amount) AS total_revenue\n    FROM orders\n    WHERE status = 'completed'\n    GROUP BY 1\n)\nSELECT\n    revenue_month,\n    total_revenue,\n    LAG(total_revenue) OVER (ORDER BY revenue_month) AS prev_month_revenue,\n    ROUND(((total_revenue - LAG(total_revenue) OVER (ORDER BY revenue_month)) / LAG(total_revenue) OVER (ORDER BY revenue_month)) * 100, 2) AS growth_percentage\nFROM monthly_revenue;",
        ),
        (
            "Optimize a slow slow-running query with high table scans.",
            "Optimization strategy: 1. Run EXPLAIN (ANALYZE, BUFFERS) to identify sequential scans. 2. Create composite index on (tenant_id, status, created_at DESC) matching WHERE and ORDER BY clauses. 3. Avoid SELECT *; project only required columns. 4. Ensure foreign key columns have indexes to accelerate JOINs.",
        ),
        (
            "Write an atomic upsert statement in PostgreSQL.",
            "INSERT INTO user_preferences (user_id, theme, notifications_enabled, updated_at)\nVALUES ('123e4567-e89b-12d3-a456-426614174000', 'dark', true, NOW())\nON CONFLICT (user_id)\nDO UPDATE SET\n    theme = EXCLUDED.theme,\n    notifications_enabled = EXCLUDED.notifications_enabled,\n    updated_at = NOW();",
        ),
    ]),

    # 8. SKILL: Cybersecurity & Hardening
    ("skill_security", "Explain the security threat and provide the remediation pattern.", [
        (
            "Cross-Site Scripting (XSS) in user profile bios.",
            "Threat: Attacker injects <script> tags or malicious event handlers that execute in viewing users' browsers.\nRemediation: 1. Contextual output encoding (escape HTML entities). 2. Use a Content Security Policy (CSP) blocking inline scripts. 3. Sanitize inputs using DOMPurify on the client and server.",
        ),
        (
            "SQL Injection (SQLi) in login queries.",
            "Threat: Untrusted user input is directly concatenated into SQL queries, bypassing password checks.\nRemediation: Always use parameterized queries or prepared statements (e.g. SELECT * FROM users WHERE email = $1). Never concatenate raw strings into SQL.",
        ),
        (
            "Insecure Direct Object Reference (IDOR).",
            "Threat: User modifies document ID in a URL (e.g., /api/invoice/456) to access another user's invoice without authorization.\nRemediation: Enforce server-side tenancy and ownership checks on every request: SELECT * FROM invoices WHERE id = $1 AND tenant_id = $2.",
        ),
        (
            "Server-Side Request Forgery (SSRF).",
            "Threat: Attacker tricks the backend into fetching internal cloud metadata (e.g. 169.254.169.254) or localhost ports.\nRemediation: Validate target URLs against a domain whitelist, block non-HTTP/HTTPS schemes, resolve DNS and reject private RFC 1918 / loopback IP addresses.",
        ),
    ]),

    # 9. SKILL: Algorithm & Complexity Analysis
    ("skill_algorithms", "Derive the time and space complexity of the algorithm with clear justification.", [
        (
            "Merge Sort on an array of length N.",
            "Time Complexity: O(N log N) in best, average, and worst cases because the array is divided log N times and merging takes linear O(N) time at each level.\nSpace Complexity: O(N) auxiliary memory to hold merged subarrays.",
        ),
        (
            "Dijkstra's Shortest Path with a Min-Heap (Priority Queue).",
            "Time Complexity: O((V + E) log V), where V is the number of vertices and E is the number of edges. Each vertex is extracted in O(log V) and edge weights are relaxed in O(log V).\nSpace Complexity: O(V + E) to store the adjacency list and distance array.",
        ),
        (
            "Quick Select algorithm for finding the Kth smallest element.",
            "Time Complexity: Average case O(N) because half of the partition is discarded at each step (N + N/2 + N/4 ... = 2N). Worst case O(N^2) if pivot selection is unbalanced.\nSpace Complexity: O(1) iterative or O(log N) recursion stack space.",
        ),
        (
            "Breadth-First Search (BFS) on an unweighted graph.",
            "Time Complexity: O(V + E) as every vertex is enqueued once and every adjacent edge is checked once.\nSpace Complexity: O(V) to store the visited set and the FIFO traversal queue.",
        ),
    ]),
]

# ---------------------------------------------------------------------------
# Distinct Evaluation Families for Validation
# ---------------------------------------------------------------------------
PLANNER_CODER_EVAL_FAMILIES: list[tuple[str, str, list[tuple[str, str]]]] = [
    ("planner_agent", "Provide an architectural plan and key milestones for the system.", [
        (
            "Design an automated database backup and restore system.",
            "Architecture: Agent daemon, GCS/S3 storage bucket, and verification coordinator.\nMilestones:\n1. Snapshot Engine: Point-in-time recovery and delta compression.\n2. Cloud Transfer: Chunked encrypted upload with retry.\n3. Drill Automation: Nightly test restore in isolated sandbox.",
        ),
        (
            "Design a central audit logging infrastructure.",
            "Architecture: Sidecar log collector, OpenSearch/Elastic cluster, and audit UI.\nMilestones:\n1. Standard Event Schema: Structured JSON with actor, action, and timestamp.\n2. Immutable Ingestion: WORM storage to prevent log tampering.\n3. Query & Alerting: Real-time alerting for anomaly patterns.",
        ),
    ]),
    ("coder_agent", "Write the production code and explain the key safeguard.", [
        (
            "Implement a thread-safe singleton in Python.",
            "import threading\n\nclass Singleton:\n    _instance = None\n    _lock = threading.Lock()\n\n    def __new__(cls):\n        if cls._instance is None:\n            with cls._lock:\n                if cls._instance is None:\n                    cls._instance = super().__new__(cls)\n        return cls._instance\n\nSafeguard: Double-checked locking prevents race conditions during concurrent initialization.",
        ),
        (
            "Write a rate limiter middleware using token bucket in TypeScript.",
            "export class TokenBucket {\n  private tokens: number;\n  private lastRefill: number;\n  constructor(private capacity: number, private refillRatePerSec: number) {\n    this.tokens = capacity;\n    this.lastRefill = Date.now();\n  }\n  allowRequest(): boolean {\n    const now = Date.now();\n    const elapsed = (now - this.lastRefill) / 1000;\n    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerSec);\n    this.lastRefill = now;\n    if (this.tokens >= 1) { this.tokens -= 1; return true; }\n    return false;\n  }\n}\n\nSafeguard: Continuous refill based on timestamp delta prevents timer drift.",
        ),
    ]),
    ("skill_security", "Identify the vulnerability and how to prevent it.", [
        (
            "Cross-Site Request Forgery (CSRF) in state-changing POST requests.",
            "Vulnerability: A malicious website submits a form to the authenticated application using the user's ambient session cookies.\nPrevention: 1. Use SameSite=Strict or SameSite=Lax cookies. 2. Enforce Anti-CSRF tokens in headers for state-changing requests.",
        ),
        (
            "JWT token signature validation bypass.",
            "Vulnerability: Setting algorithm to 'none' or mixing symmetric HMAC with public asymmetric RSA keys.\nPrevention: Always enforce an explicit algorithm whitelist (e.g. ['RS256']) and never trust the 'alg' header from unverified tokens.",
        ),
    ]),
]


def build_records(families: list[tuple[str, str, list[tuple[str, str]]]]) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for category, instruction, examples in families:
        for user_input, output in examples:
            records.append(
                {
                    "instruction": instruction,
                    "input": user_input,
                    "output": output,
                    "category": category,
                    "provenance": PROVENANCE,
                    "license": LICENSE_STATUS,
                }
            )
    return records


def write_jsonl(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in records),
        encoding="utf-8",
    )


def main() -> None:
    train_records = build_records(PLANNER_CODER_TRAIN_FAMILIES)
    eval_records = build_records(PLANNER_CODER_EVAL_FAMILIES)
    
    # Save specialized planner/coder datasets
    train_path = GENERATED / "planner-coder-skills-train.jsonl"
    eval_path = GENERATED / "planner-coder-skills-eval.jsonl"
    write_jsonl(train_path, train_records)
    write_jsonl(eval_path, eval_records)
    
    # Combine with base synthetic expansion data to create comprehensive training set
    base_train = []
    base_eval = []
    if (GENERATED / "synthetic-expansion-train.jsonl").exists():
        for line in (GENERATED / "synthetic-expansion-train.jsonl").read_text(encoding="utf-8").splitlines():
            if line.strip():
                base_train.append(json.loads(line))
    if (GENERATED / "synthetic-expansion-eval.jsonl").exists():
        for line in (GENERATED / "synthetic-expansion-eval.jsonl").read_text(encoding="utf-8").splitlines():
            if line.strip():
                base_eval.append(json.loads(line))
                
    combined_train = base_train + train_records
    combined_eval = base_eval + eval_records
    
    combined_train_path = GENERATED / "comprehensive-powerful-train.jsonl"
    combined_eval_path = GENERATED / "comprehensive-powerful-eval.jsonl"
    write_jsonl(combined_train_path, combined_train)
    write_jsonl(combined_eval_path, combined_eval)
    
    print(
        json.dumps(
            {
                "planner_coder_skills_train": len(train_records),
                "planner_coder_skills_eval": len(eval_records),
                "combined_train_records": len(combined_train),
                "combined_eval_records": len(combined_eval),
                "train_path": str(combined_train_path),
                "eval_path": str(combined_eval_path),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()

