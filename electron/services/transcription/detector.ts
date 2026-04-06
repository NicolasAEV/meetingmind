// ─── Technical-query detector ─────────────────────────────────────────────────
// Pure logic module — no Electron imports, fully testable in isolation.

// Normalize accents so patterns match regardless of whether Whisper transcribes
// "qué" or "que", "cómo" or "como", etc.
function normalize(text: string): string {
  return text.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '')
}

const QUERY_PATTERNS = [
  /[¿?]?\s*como\s+(se\s+)?(hace|funciona|implementa|usa|instala|configura|despliega)/i,
  /[¿?]?\s*que\s+(es|son|hace|significa|ventaja|diferencia)/i,
  /[¿?]?\s*cual\s+(es|son|seria|deberia)/i,
  /[¿?]?\s*cuando\s+(usar|se\s+usa|conviene|debo)/i,
  /[¿?]?\s*por\s+que\s+(no|si|se|es|hay|usar)/i,
  /\bvs\.?\s+\b|\bversus\b/i,
  /diferencia\s+(entre|de|con)/i,
  /mejor\s+(opcion|alternativa|practica|herramienta)/i,
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
  'node', 'nodejs', 'node.js', 'deno', 'bun', 'python', 'java', 'go', 'rust',
  'fastapi', 'express', 'spring', 'django', 'laravel', 'rails',
  // Data
  'sql', 'nosql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
  'kafka', 'rabbitmq', 'database', 'orm', 'migration',
  // AI / ML
  'machine learning', 'deep learning', 'llm', 'transformer', 'embedding',
  'vector', 'fine-tuning', 'rag', 'neural network', 'gpu',
  'whisper', 'ollama', 'inteligencia artificial', ' ia ',
  // Patterns / architecture
  'arquitectura', 'architecture', 'pattern', 'solid', 'clean code',
  'algorithm', 'algoritmo', 'cache', 'queue', 'async',
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
  const lower = normalize(text.toLowerCase())

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
