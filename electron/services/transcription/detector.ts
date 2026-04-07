// ─── Technical-query detector ─────────────────────────────────────────────────
// Pure logic module — no Electron imports, fully testable in isolation.

// Normalize accents so patterns match regardless of whether Whisper transcribes
// "qué" or "que", "cómo" or "como", etc.
function normalize(text: string): string {
  return text.normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '')
}

const QUERY_PATTERNS = [
  // ── ESPAÑOL ──
  // Introducciones conversacionales
  /me\s+(puedes|podrias)\s+explicar/i,
  /queria\s+saber/i,
  /quiero\s+entender/i,
  /tengo\s+una\s+duda\s+con/i,

  // Preguntas puras de "Qué", "Quién", "De qué"
  /[¿?]?\s*(que|quien|quienes)\s+(es|son|hace|significa|quiere\s+decir|implicaría|ventaja|desventaja|diferencias?|proposito|utilidad)/i,
  /[¿?]?\s*a\s+que\s+(se\s+refiere|nos\s+referimos)\s+con/i,
  /[¿?]?\s*de\s+que\s+(trata|sirve|hablas\s+cuando\s+dices)/i,
  /[¿?]?\s*en\s+que\s+consiste/i,

  // Preguntas "Cómo" (Implementación, funcionamiento)
  /[¿?]?\s*como\s+(se\s+)?(hace|funciona|implementa|usa|utiliza|instala|configura|despliega|resuelve|crea|construye|programa|desarrolla|estructura|optimiza)/i,
  /[¿?]?\s*como\s+(puedo|podemos)\s+(hacer|implementar|usar|resolver|crear|lograr)/i,

  // Preguntas "Cuál/Qué" (Elecciones, motivos)
  /[¿?]?\s*cual(es)?\s+(es|son|seria|serian|deberia|crees\s+que\s+es)\s+(la\s+|el\s+)?(motivo|razon|mejor|peor|idea|concepto)/i,
  /[¿?]?\s*que\s+(opcion|alternativa|herramienta|tecnologia)\s+(recomiendas|es\s+mejor|deberiamos\s+usar)/i,

  // Preguntas "Cuándo/Dónde/Por qué"
  /[¿?]?\s*cuando\s+(usar|se\s+usa|conviene|debo|deberia|utilizar|aplicar)/i,
  /[¿?]?\s*donde\s+(se\s+usa|aplica|podemos\s+usar)/i,
  // Permite palabras intermedias: "por qué debería usar", "por qué no se puede"
  /[¿?]?\s*por\s+que\s+(?:\w+\s+){0,3}(usar|utilizar|elegir|no|si|se|falla|sucede|rompe|deberia|conviene)/i,

  // Comparaciones
  /\bvs\.?\s+\b|\bversus\b/i,
  /diferencias?\s+(entre|de|con|a|vs|respecto\s+a)/i,
  /comparad[oa]\s+con/i,

  // Recomendaciones / Valoraciones
  /mejor\s+(opcion|alternativa|practica|herramienta|forma|manera|arquitectura|patron)/i,
  /pros?\s+and\s+cons|trade[- ]?offs?|ventajas?\s+(y|o|vs)\s+desventajas?|beneficios?/i,

  // Directivas e Imperativos
  /explic[aáo]\s*(que|como|cual|la diferencia|el concepto|el contexto)/i,
  /(dime|decime|cuentame|describeme|defineme)\s+que\s+(es|hace|significa)/i,
  /(dame|muestra|mostrame|da)\s+(un\s+)?ejemplo\s+de/i,
  /para\s+que\s+(sirve|se\s+usa|utilizamos|te\s+sirve)/i,
  /hablame\s+sobre|cuentame\s+un\s+poco\s+de|un\s+resumen\s+de/i,

  // Definición de conceptos clave
  /concepto\s+de/i,
  /significado\s+de/i,
  /definicion\s+de/i,

  // ── INGLÉS ──
  /[¿?]?\s*how\s+(does|do|to|is|are|would|can|should)/i,
  /[¿?]?\s*what\s+(is|are|does|difference|purpose|gives|meaning)/i,
  /[¿?]?\s*which\s+(is|are|one|should|would|do\s+you\s+prefer)/i,
  /[¿?]?\s*when\s+(to\s+use|should|do\s+i|would\s+you)/i,
  /[¿?]?\s*why\s+(is|are|does|should|do)/i,
  /(can|could|would)\s+you\s+explain/i,
  /(give|show)\s+me\s+an?\s+example/i,
  /tell\s+me\s+(what|how|about)/i,
  /what\s+does\s+.*?\s+mean/i,
]

const TECH_KEYWORDS = [
  // Infra / DevOps / Cloud
  'docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp', 'terraform', 'ansible', 'chef', 'puppet',
  'serverless', 'microservices', 'monolith', 'container', 'pod', 'firebase', 'supabase', 
  'cloudflare', 'vercel', 'heroku', 'linux', 'ubuntu', 'debian', 'centos', 'alpine', 'redhat',
  'ci/cd', 'pipeline', 'github actions', 'jenkins', 'monitoring', 'gitlab', 'bitbucket',
  'logging', 'observability', 'prometheus', 'grafana', 'datadog', 'docker-compose', 'vagrant',
  
  // Networking / Segurdiad / Web
  'api', 'rest', 'graphql', 'grpc', 'websocket', 'http', 'https', 'tcp', 'udp', 'dns', 'ip',
  'json', 'xml', 'yaml', 'oauth', 'jwt', 'cors', 'ssl', 'tls', 'ssh', 'ftp', 'smtp',
  'proxy', 'nginx', 'apache', 'load balancer', 'firewall', 'vpn', 'token', 'session',
  
  // Frontend / UI / UX
  'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'remix', 'gatsby', 'astro',
  'typescript', 'javascript', 'css', 'html', 'dom', 'vite', 'webpack', 'babel', 'rollup', 'esbuild',
  'tailwind', 'bootstrap', 'material-ui', 'redux', 'zustand', 'pinia', 'sass', 'less', 'postcss',
  'framer motion', 'threejs', 'webgl', 'canvas', 'svg', 'seo', 'accessibility', 'a11y', 'wasm',
  
  // Backend / Lenguajes
  'node', 'nodejs', 'node.js', 'deno', 'bun', 'python', 'java', 'go', 'rust', 'cumbia',
  'fastapi', 'express', 'spring', 'django', 'laravel', 'rails', 'php', 'c++', 'c#', 'ruby',
  'c', 'scala', 'elixir', 'erlang', 'haskell', 'clojure', 'perl', 'lua', 'assembly', 'golang',
  'nest', 'nestjs', 'koa', 'flask', 'asp.net', 'dotnet', '.net',
  
  // Mobile / Desktop
  'kotlin', 'swift', 'dart', 'flutter', 'react native', 'ionic', 'capacitor', 'cordova',
  'electron', 'tauri', 'windows', 'macos', 'android', 'ios', 'xcode', 'android studio',
  
  // Bases de Datos / Almacenamiento
  'sql', 'nosql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb',
  'kafka', 'rabbitmq', 'database', 'orm', 'migration', 'mysql', 'sqlite', 'prisma', 'mariadb',
  'mongoose', 'supabase', 'typeorm', 'sequelize', 'couchdb', 'neo4j', 'graphql', 'apollo',
  
  // AI / ML / Data Science
  'machine learning', 'deep learning', 'llm', 'transformer', 'embedding', 'pandas', 'numpy',
  'vector', 'fine-tuning', 'rag', 'neural network', 'gpu', 'cuda', 'tensor', 'tensorflow', 'pytorch',
  'whisper', 'ollama', 'inteligencia artificial', ' ia ', 'openai', 'chatgpt', 'claude', 'gemini',
  'huggingface', 'stable diffusion', 'midjourney', 'prompt', 'dataset', 'scikit-learn', 'keras',
  
  // Git / Herramientas
  'git', 'github', 'bash', 'powershell', 'cmd', 'terminal', 'shell', 'zsh', 'iterm',
  'npm', 'yarn', 'pnpm', 'cargo', 'pip', 'composer', 'maven', 'gradle', 'nuget', 'brew',
  
  // Arquitectura / Patrones / Conceptos
  'arquitectura', 'architecture', 'pattern', 'patron', 'solid', 'clean code', 'mvc', 'mvvm', 'mvi',
  'algorithm', 'algoritmo', 'cache', 'queue', 'async', 'oop', 'funcional', 'hexagonal',
  'ddd', 'tdd', 'bdd', 'agile', 'scrum', 'kanban', 'sprint', 'refactor', 'debugging',
  'memory leak', 'garbage collector', 'thread', 'concurrency', 'parallelism', 'mutex', 'deadlock',
  'design pattern', 'singleton', 'factory', 'observer', 'dependency injection', 'middleware',
  'decorator', 'decorador', 'strategy', 'estrategia', 'adapter', 'facade', 'builder', 'prototype',
  'repository', 'service layer', 'event sourcing', 'cqrs', 'proxy', 'command', 'iterator',
]

export interface DetectionResult {
  isTechnical: boolean
  confidence: number        // 0 – 1
  matchedKeywords: string[]
  matchedPattern?: string
}

// ── Palabras de pregunta en español e inglés ─────────────────────────────────
const QUESTION_WORDS = [
  'como', 'que', 'quien', 'quienes', 'cual', 'cuales', 'cuando', 'donde',
  'cuanto', 'cuantos', 'por que', 'para que', 'de que', 'en que', 'a que',
  'how', 'what', 'who', 'which', 'when', 'where', 'why', 'does', 'do',
]

export function detectTechnicalQuery(text: string): DetectionResult {
  const lower = normalize(text.toLowerCase())

  // Señal 1: Patrón estructurado (regex)
  let matchedPattern: string | undefined
  for (const pattern of QUERY_PATTERNS) {
    if (pattern.test(lower)) {
      matchedPattern = pattern.source
      break
    }
  }

  // Señal 2: Keywords técnicos
  const matchedKeywords = TECH_KEYWORDS.filter(kw => lower.includes(kw))

  // Señal 3: Signo de interrogación
  const hasQuestionMark = /[?¿]/.test(text)

  // Señal 4: Palabra interrogativa suelta
  const hasQuestionWord = QUESTION_WORDS.some(qw => lower.includes(qw))

  // Motor de puntuación híbrido — cualquier combinación razonable dispara la nota
  let confidence = 0

  // Patrón regex estructurado fuerte
  if (matchedPattern) confidence = Math.max(confidence, 0.50)
  // ? o ¿ + keyword = casi certeza
  if (hasQuestionMark && matchedKeywords.length >= 1) confidence = Math.max(confidence, 0.75)
  // Palabra de pregunta + keyword = muy probable
  if (hasQuestionWord && matchedKeywords.length >= 1) confidence = Math.max(confidence, 0.55)
  // Discusión técnica sin pregunta explícita (2+ keywords)
  if (matchedKeywords.length >= 2) confidence = Math.max(confidence, 0.45)

  // Bonus acumulativo por cada keyword técnico
  confidence += Math.min(matchedKeywords.length * 0.12, 0.40)
  confidence = Math.min(confidence, 1)

  return {
    isTechnical: confidence >= 0.55,
    confidence,
    matchedKeywords,
    matchedPattern,
  }
}
