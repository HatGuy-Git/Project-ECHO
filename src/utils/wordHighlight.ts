export interface MessageToken {
  text: string
  isWord: boolean
}

export interface WordTiming {
  startTime: number
  endTime: number
}

export interface CharacterAlignment {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export function tokenizeMessage(message: string): MessageToken[] {
  return message
    .split(/(\s+)/)
    .filter((part) => part.length > 0)
    .map((text) => ({
      text,
      isWord: /\S/.test(text),
    }))
}

export function countWords(message: string): number {
  return tokenizeMessage(message).filter((token) => token.isWord).length
}

/**
 * Map ElevenLabs character alignment to per-word start/end times.
 */
export function buildWordTimingsFromAlignment(
  message: string,
  alignment: CharacterAlignment
): WordTiming[] {
  const words = tokenizeMessage(message).filter((token) => token.isWord)
  if (words.length === 0) return []

  const alignedText = alignment.characters.join('')
  const sourceText = alignedText.length === message.length ? message : alignedText

  let searchFrom = 0
  const timings: WordTiming[] = []

  for (const word of words) {
    const tokenStart = sourceText.indexOf(word.text, searchFrom)
    if (tokenStart === -1) continue
    const tokenEnd = tokenStart + word.text.length - 1
    searchFrom = tokenStart + word.text.length

    const startTime = alignment.character_start_times_seconds[tokenStart]
    const endTime = alignment.character_end_times_seconds[tokenEnd]

    if (startTime === undefined || endTime === undefined) continue

    timings.push({ startTime, endTime })
  }

  return timings
}

/**
 * Fallback timings weighted by letter count when alignment is unavailable.
 */
export function buildEstimatedWordTimings(message: string, durationSeconds: number): WordTiming[] {
  const words = tokenizeMessage(message).filter((token) => token.isWord)
  if (words.length === 0) return []

  const weights = words.map((token) =>
    Math.max(1, token.text.replace(/[^a-zA-Z]/g, '').length)
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  const effectiveDuration = Math.max(durationSeconds, 0.5)

  let elapsed = 0
  return weights.map((weight) => {
    const slice = (weight / totalWeight) * effectiveDuration
    const timing = { startTime: elapsed, endTime: elapsed + slice }
    elapsed += slice
    return timing
  })
}

/**
 * Find which word should be highlighted at a given playback time.
 */
export function getActiveWordIndex(wordTimings: WordTiming[], elapsedSeconds: number): number | null {
  if (wordTimings.length === 0) return null

  let activeIndex: number | null = null
  for (let i = 0; i < wordTimings.length; i++) {
    if (elapsedSeconds >= wordTimings[i].startTime) {
      activeIndex = i
    } else {
      break
    }
  }

  return activeIndex
}

/**
 * Get playback start time for a word index (for click-to-seek).
 */
export function getWordStartTime(wordTimings: WordTiming[], wordIndex: number): number {
  return wordTimings[wordIndex]?.startTime ?? 0
}
