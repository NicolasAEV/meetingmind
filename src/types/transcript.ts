export interface TranscriptEntry {
  id:               string
  text:             string
  timestamp:        number
  source:           'mic' | 'system'
  isTechnicalQuery: boolean
}

export interface TranscriptResult {
  text:             string
  source:           'mic' | 'system'
  isTechnicalQuery: boolean
  confidence:       number
}
