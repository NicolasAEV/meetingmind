// ─── Technical-query detector ─────────────────────────────────────────────────
// Pure logic module — no Electron imports, fully testable in isolation.

const QUERY_PATTERNS = [
  /[¿?]?\s*cómo\s+(se\s+)?(hace|funciona|implementa|usa|instala|configura|despliega)/i,
  /[¿?]?\s*qué\s+(es|son|hace|significa|ventaja|diferencia)/i,
  /[¿?]?\s*cuál\s+(es|son|sería|debería)/i,
  /[¿?]?\s*cuándo\s+(usar|se\s+usa|conviene|debo)/i,
  /\bvs\.?\s+\b|\bversus\b/i,
  /diferencia\s+(entre|de|con)/i,
  /mejor\s+(opción|alternativa|práctica|herramienta)/i,
  /[¿?]?\s*how\s+(does|do|to|is|are|would)/i,
  /[¿?]?\s*what\s+(is|are|does|difference)/i,
  /[¿?]?\s*which\s+(is|are|one|should)/i,
  /[¿?]?\s*when\s+(to\s+use|should|do\s+i)/i,
  /pros?\s+and\s+cons|trade[- ]?offs?/i,
]

const TECH_KEYWORDS = [
  // Infra / cloud
  'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'terraform',
  'serverless', 'microservices', 'monolith', 'container', 'pod',
  // Networking / protocols
  'api', 'rest', 'graphql', 'grpc', 'websocket', 'http', 'tcp', 'dns',
  // Frontend
  'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'remix',
  'typescript', 'javascript', 'css', 'html', 'dom', 'vite', 'webpack',
  // Backend
  'node', 'deno', 'bun', 'python', 'java', 'go', 'rust', 'fastapi',
  'express', 'spring', 'django', 'laravel', 'rails',
  // Data
  'sql', 'nosql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
  'kafka', 'rabbitmq', 'database', 'orm', 'migration',
  // AI / ML
  'machine learning', 'deep learning', 'llm', 'transformer', 'embedding',
  'vector', 'fine-tuning', 'rag', 'neural network', 'gpu',
  // Patterns / architecture
  'arquitectura', 'architecture', 'pattern', 'solid', 'clean code',
  'algorithm', 'algoritmo', 'cache', 'caché', 'queue', 'async',
  // DevOps
  'ci/cd', 'pipeline', 'github actions', 'jenkins', 'monitoring',
  'logging', 'observability', 'prometheus', 'grafana',
]

export interface DetectionResult {
  isTechnical: boolean
  confidence: number        // 0 – 1
  matchedKeywords: string[]
  matchedPattern?: string
}

export function detectTechnicalQuery(text: string): DetectionResult {
  const lower = text.toLowerCase()

  let matchedPattern: string | undefined
  for (const pattern of QUERY_PATTERNS) {
    if (pattern.test(lower)) {
      matchedPattern = pattern.source
      break
    }
  }

  const matchedKeywords = TECH_KEYWORDS.filter(kw => lower.includes(kw))

  // Confidence formula: pattern worth 0.6, each keyword adds 0.15 (capped at 0.4)
  let confidence = 0
  if (matchedPattern) confidence += 0.6
  confidence += Math.min(matchedKeywords.length * 0.15, 0.4)
  confidence = Math.min(confidence, 1)

  return {
    isTechnical: confidence >= 0.55,
    confidence,
    matchedKeywords,
    matchedPattern,
  }
}
