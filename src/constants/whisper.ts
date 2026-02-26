export interface WhisperModelOption {
  value: string
  label: string
  group: 'multilingual' | 'english' | 'distil'
}

export const WHISPER_MODEL_GROUPS: Record<'multilingual' | 'english' | 'distil', string> = {
  multilingual: 'Multilingüe',
  english:      'Solo inglés (más rápido)',
  distil:       'Distil-Whisper (optimizado)',
}

export const WHISPER_MODELS: WhisperModelOption[] = [
  { group: 'multilingual', value: 'Xenova/whisper-tiny',               label: 'whisper-tiny (~150 MB)' },
  { group: 'multilingual', value: 'Xenova/whisper-base',               label: 'whisper-base (~290 MB)' },
  { group: 'multilingual', value: 'Xenova/whisper-small',              label: 'whisper-small (~970 MB)' },
  { group: 'multilingual', value: 'Xenova/whisper-medium',             label: 'whisper-medium (~3 GB)' },
  { group: 'multilingual', value: 'Xenova/whisper-large-v2',           label: 'whisper-large-v2 (~6 GB)' },
  { group: 'multilingual', value: 'Xenova/whisper-large-v3',           label: 'whisper-large-v3 (~6 GB)' },

  { group: 'english', value: 'Xenova/whisper-tiny.en',                 label: 'whisper-tiny.en (~150 MB)' },
  { group: 'english', value: 'Xenova/whisper-base.en',                 label: 'whisper-base.en (~290 MB)' },
  { group: 'english', value: 'Xenova/whisper-small.en',                label: 'whisper-small.en (~970 MB)' },
  { group: 'english', value: 'Xenova/whisper-medium.en',               label: 'whisper-medium.en (~3 GB)' },

  { group: 'distil', value: 'Xenova/distil-whisper-large-v2',          label: 'distil-whisper-large-v2 (~1.5 GB)' },
  { group: 'distil', value: 'Xenova/distil-whisper-large-v3',          label: 'distil-whisper-large-v3 (~1.5 GB)' },
  { group: 'distil', value: 'Xenova/distil-whisper-medium.en',         label: 'distil-whisper-medium.en (~750 MB)' },
  { group: 'distil', value: 'Xenova/distil-whisper-small.en',          label: 'distil-whisper-small.en (~250 MB)' },
]
