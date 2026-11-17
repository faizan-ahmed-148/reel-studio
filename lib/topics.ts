/**
 * Built-in software topic bank. A topic is used at most once (tracked in settings.usedTopics);
 * when a category runs out, Groq invents fresh topics for it, still checked against the used list.
 */
export const CATEGORIES: Record<string, string[]> = {
  "System Design": [
    "Load Balancer kaise kaam karta hai", "Horizontal vs Vertical Scaling", "CDN kya hai aur kyun zaroori hai",
    "Caching strategies: write-through, write-back, cache-aside", "Rate Limiter kaise design karein", "URL Shortener ka system design",
    "Consistent Hashing", "Database Sharding", "Database Replication: leader-follower", "CAP Theorem",
    "Message Queue kyun use karte hain", "Pub/Sub architecture", "API Gateway", "Reverse Proxy vs Forward Proxy",
    "WhatsApp jaisa chat system design", "YouTube video streaming ka architecture", "Notification system design",
    "Instagram feed kaise banti hai", "Uber ride matching system", "Distributed locks", "Idempotency in APIs",
    "Circuit Breaker pattern", "Service Discovery", "Event-driven architecture", "Saga pattern for distributed transactions",
    "Leader election", "Heartbeats aur health checks", "Bloom Filter", "Search autocomplete system design",
    "Payment system design", "Distributed cache (Redis cluster)", "Back-pressure", "Single point of failure se bachna",
    "Read-heavy vs write-heavy systems", "Google Docs real-time collaboration kaise kaam karta hai",
    "Web crawler design", "Ticket booking system aur race conditions", "Multi-region deployment", "Blue-green deployment",
    "Canary releases",
  ],
  "Backend": [
    "REST API kya hai", "GraphQL vs REST", "gRPC kya hai", "WebSockets vs HTTP polling", "Server-Sent Events",
    "Authentication vs Authorization", "JWT kaise kaam karta hai", "OAuth 2.0 flow", "Session vs Token auth",
    "API versioning", "Pagination: offset vs cursor", "Webhooks kya hain", "Background jobs aur workers",
    "Cron jobs", "Microservices vs Monolith", "Serverless functions", "Node.js event loop", "Threads vs Processes",
    "Concurrency vs Parallelism", "Async/await andar se kaise chalta hai", "Connection pooling", "N+1 query problem",
    "ORM ke fayde aur nuqsan", "HTTP status codes samjho", "CORS error kyun aata hai", "Idempotent HTTP methods",
    "File upload ko scale karna", "Logging, Metrics, Tracing", "API rate limiting algorithms: token bucket",
    "Clean Architecture", "Dependency Injection", "Hexagonal architecture",
  ],
  "Databases": [
    "SQL vs NoSQL", "Database Index kaise kaam karta hai", "B-Tree index", "ACID properties", "Transactions aur isolation levels",
    "Normalization vs Denormalization", "Primary key vs Foreign key", "Joins visually samjho", "Redis kya hai",
    "MongoDB kab use karein", "PostgreSQL ki khoobiyan", "Time-series databases", "Vector database kya hai",
    "Database deadlock", "Optimistic vs Pessimistic locking", "Write-Ahead Log (WAL)", "Read replicas",
    "Query optimization: EXPLAIN", "Elasticsearch aur inverted index", "Key-value vs Document vs Graph DB",
    "Database migrations", "Soft delete vs hard delete", "UUID vs auto-increment ID", "Data warehouse vs Data lake",
    "Change Data Capture (CDC)",
  ],
  "DevOps & Cloud": [
    "Docker kya hai", "Docker image vs container", "Kubernetes basics", "Kubernetes Pods, Deployments, Services",
    "CI/CD pipeline", "Infrastructure as Code (Terraform)", "Virtual Machine vs Container", "Nginx kya karta hai",
    "AWS S3 kya hai", "AWS Lambda", "Auto-scaling", "Load testing", "Observability aur monitoring", "Prometheus aur Grafana",
    "GitHub Actions", "Environment variables aur secrets", "Zero-downtime deployment", "DNS kaise kaam karta hai",
    "SSL/TLS certificate", "Cloud regions aur availability zones", "Docker Compose", "Helm charts", "Service mesh (Istio)",
    "Backup aur disaster recovery", "Cost optimization in cloud",
  ],
  "AI & ML": [
    "LLM kaise kaam karta hai", "Tokens kya hote hain", "Embeddings kya hain", "RAG (Retrieval Augmented Generation)",
    "Fine-tuning vs Prompting", "AI Agents kya hain", "MCP (Model Context Protocol)", "Transformer architecture",
    "Attention mechanism", "Context window", "Temperature aur sampling", "Hallucination kyun hoti hai",
    "Vector search", "Neural network basics", "Training vs Inference", "GPU AI ke liye kyun zaroori hai",
    "Overfitting vs Underfitting", "Supervised vs Unsupervised learning", "AI model quantization", "Function calling / tool use",
    "Chunking strategies for RAG", "AI evals kya hain", "Prompt injection", "Multi-agent systems", "Diffusion models (image AI)",
  ],
  "Security": [
    "SQL Injection", "XSS attack", "CSRF attack", "Password hashing (bcrypt)", "HTTPS kaise secure karta hai",
    "Public key vs Private key", "DDoS attack aur bachao", "Zero Trust security", "2FA kaise kaam karta hai",
    "Secrets management", "OWASP Top 10", "Encryption at rest vs in transit", "Phishing se bachao developers ke liye",
    "Rate limiting for security", "Content Security Policy", "API keys ko secure rakhna",
  ],
  "Networking": [
    "Browser mein URL likhne ke baad kya hota hai", "TCP vs UDP", "HTTP/1.1 vs HTTP/2 vs HTTP/3", "IP address aur subnet",
    "OSI model simple tareeqay se", "TCP 3-way handshake", "NAT kya hai", "Latency vs Bandwidth", "Ports kya hote hain",
    "WebRTC kya hai", "Keep-alive connections", "Proxy servers", "VPN kaise kaam karta hai", "Anycast routing",
  ],
  "Frontend": [
    "React Virtual DOM", "Server-side rendering vs Client-side rendering", "Next.js App Router", "React hooks samjho",
    "State management (Redux vs Context)", "Web performance: Core Web Vitals", "Lazy loading", "Browser rendering pipeline",
    "Hydration kya hai", "Micro-frontends", "Progressive Web Apps", "Debounce vs Throttle", "Local storage vs Cookies",
    "Service Workers", "Bundlers (Webpack, Vite)", "Tailwind CSS kyun popular hai", "Accessibility basics",
  ],
  "DSA": [
    "Big O notation", "Array vs Linked List", "Hash Map andar se", "Stack aur Queue", "Binary Search", "Recursion",
    "Two pointers technique", "Sliding window", "BFS vs DFS", "Dijkstra algorithm", "Dynamic Programming basics",
    "Trees aur Binary Search Tree", "Heap / Priority Queue", "Graph kya hai", "Sorting algorithms compare",
    "Trie data structure", "LRU Cache design",
  ],
  "Programming Concepts": [
    "OOP ke 4 pillars", "SOLID principles", "Design patterns: Singleton", "Factory pattern", "Observer pattern",
    "Strategy pattern", "Functional programming basics", "Immutability", "Garbage collection", "Memory leak",
    "Compiled vs Interpreted languages", "Static vs Dynamic typing", "TypeScript kyun", "Unit vs Integration vs E2E tests",
    "Test Driven Development", "Clean code tips", "Code review best practices", "Technical debt", "Refactoring",
    "Pure functions", "Error handling best practices",
  ],
  "Git & Tools": [
    "Git kaise kaam karta hai", "Git merge vs rebase", "Git branching strategy", "Pull Request workflow",
    "Git stash", "Semantic versioning", "Monorepo vs Polyrepo", "Linux commands har developer ke liye", "VS Code productivity",
    "Package managers (npm, pnpm)", "Feature flags",
  ],
  "Real-World Architecture": [
    "Netflix ka architecture", "Uber ka architecture", "WhatsApp 2 billion users kaise handle karta hai", "Discord messages kaise store karta hai",
    "Twitter/X timeline", "Amazon shopping cart", "Spotify recommendations", "Google Search kaise kaam karta hai",
    "Daraz / e-commerce sale traffic", "JazzCash / payment wallet ka architecture", "Careem / food delivery system",
    "ChatGPT ka backend", "Zoom video calls", "Airbnb search", "Stripe payments ki reliability",
  ],
};

export const ALL_CATEGORIES = Object.keys(CATEGORIES);

export const normTopic = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Pick the next unused topic from the bank, rotating through the selected categories. */
/** Built-in bank merged with the user's own topics. */
export function allTopics(custom: Record<string, string[]> = {}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const c of new Set([...ALL_CATEGORIES, ...Object.keys(custom)])) out[c] = [...(custom[c] ?? []), ...(CATEGORIES[c] ?? [])];
  return out;
}

export function pickBankTopic(categories: string[], used: string[], lastCategory?: string, custom: Record<string, string[]> = {}): { topic: string; category: string } | null {
  const usedSet = new Set(used.map(normTopic));
  const BANK = allTopics(custom);
  const cats = (categories.length ? categories : Object.keys(BANK)).filter((c) => BANK[c]?.length);
  if (!cats.length) return null;
  // rotate: start after the last used category so consecutive days differ
  const start = lastCategory ? (cats.indexOf(lastCategory) + 1) % cats.length : Math.floor(Math.random() * cats.length);
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[(start + i) % cats.length];
    const fresh = BANK[cat].filter((t) => !usedSet.has(normTopic(t)));
    // your own topics first, then a random built-in one
    const own = (custom[cat] ?? []).filter((t) => !usedSet.has(normTopic(t)));
    if (own.length) return { topic: own[0], category: cat };
    if (fresh.length) return { topic: fresh[Math.floor(Math.random() * fresh.length)], category: cat };
  }
  return null;
}

export function bankStats(categories: string[], used: string[], custom: Record<string, string[]> = {}) {
  const usedSet = new Set(used.map(normTopic));
  const BANK = allTopics(custom);
  const cats = categories.length ? categories : Object.keys(BANK);
  let total = 0, left = 0;
  for (const c of cats) for (const t of BANK[c] ?? []) { total++; if (!usedSet.has(normTopic(t))) left++; }
  return { total, left };
}
