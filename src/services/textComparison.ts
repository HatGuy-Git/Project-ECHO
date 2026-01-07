/**
 * Text Comparison Service
 * 
 * Compares user input against original text for dictation and recitation checking.
 * Uses fuzzy matching to be forgiving of minor differences while catching actual errors.
 */

import type { ComparisonResult, WordComparison } from '../types'

/**
 * Normalize text for comparison
 * - Convert to lowercase
 * - Remove punctuation
 * - Normalize whitespace
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '') // Keep apostrophes for contractions
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split text into words
 */
function tokenize(text: string): string[] {
  return normalizeText(text).split(' ').filter(word => word.length > 0)
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Check if two words are similar enough (fuzzy match)
 * Returns true if words are identical or within acceptable edit distance
 * For a spelling-focused app, we want to be strict - only allow minor typos
 */
function wordsMatch(original: string, input: string, tolerance = 0.1): boolean {
  // Exact match
  if (original === input) return true
  
  // For short words (3 letters or less), require exact match
  const maxLength = Math.max(original.length, input.length)
  if (maxLength <= 3) return false
  
  // For longer words, allow minimal tolerance (1 character typo on long words)
  const distance = levenshteinDistance(original, input)
  
  // Allow at most 1 character error for words 5+ characters
  // This catches typos but not spelling errors like knight/night
  if (distance > 1) return false
  
  const similarity = 1 - (distance / maxLength)
  return similarity >= (1 - tolerance)
}

/**
 * Compare two texts and return detailed comparison results
 */
export function compareTexts(original: string, input: string): ComparisonResult {
  const originalWords = tokenize(original)
  const inputWords = tokenize(input)
  
  const wordResults: WordComparison[] = []
  let correctCount = 0
  
  // Use dynamic programming to align words (simplified LCS-based approach)
  const maxLen = Math.max(originalWords.length, inputWords.length)
  
  let origIndex = 0
  let inputIndex = 0
  
  while (origIndex < originalWords.length || inputIndex < inputWords.length) {
    const origWord = originalWords[origIndex]
    const inputWord = inputWords[inputIndex]
    
    if (origIndex >= originalWords.length) {
      // Extra words in input
      wordResults.push({
        original: '',
        input: inputWord,
        isCorrect: false,
        isMissing: false,
        isExtra: true,
      })
      inputIndex++
    } else if (inputIndex >= inputWords.length) {
      // Missing words from input
      wordResults.push({
        original: origWord,
        input: null,
        isCorrect: false,
        isMissing: true,
        isExtra: false,
      })
      origIndex++
    } else if (wordsMatch(origWord, inputWord)) {
      // Words match (exact or fuzzy)
      wordResults.push({
        original: origWord,
        input: inputWord,
        isCorrect: true,
        isMissing: false,
        isExtra: false,
      })
      correctCount++
      origIndex++
      inputIndex++
    } else {
      // Check if it's a missing word or wrong word
      // Look ahead to see if the input word matches a later original word
      let foundLater = false
      for (let i = origIndex + 1; i < Math.min(origIndex + 3, originalWords.length); i++) {
        if (wordsMatch(originalWords[i], inputWord)) {
          // Current original word is missing
          wordResults.push({
            original: origWord,
            input: null,
            isCorrect: false,
            isMissing: true,
            isExtra: false,
          })
          origIndex++
          foundLater = true
          break
        }
      }
      
      if (!foundLater) {
        // Wrong word
        wordResults.push({
          original: origWord,
          input: inputWord,
          isCorrect: false,
          isMissing: false,
          isExtra: false,
        })
        origIndex++
        inputIndex++
      }
    }
  }
  
  const matchPercentage = originalWords.length > 0 
    ? (correctCount / originalWords.length) * 100 
    : 100
  
  return {
    isMatch: matchPercentage >= 90, // 90% threshold for "match"
    matchPercentage,
    originalWords,
    inputWords,
    wordResults,
  }
}

/**
 * Simple exact match comparison (for strict checking)
 */
export function exactMatch(original: string, input: string): boolean {
  return normalizeText(original) === normalizeText(input)
}

/**
 * Get a list of incorrect/missing words from comparison
 */
export function getIncorrectWords(result: ComparisonResult): string[] {
  return result.wordResults
    .filter(w => !w.isCorrect && !w.isExtra && w.original)
    .map(w => w.original)
}

/**
 * Format comparison result for display
 */
export function formatComparisonForDisplay(result: ComparisonResult): {
  displayText: string
  incorrectIndices: number[]
} {
  const parts: string[] = []
  const incorrectIndices: number[] = []
  
  result.wordResults.forEach((word, index) => {
    if (word.isCorrect) {
      parts.push(word.original)
    } else if (word.isMissing) {
      parts.push(`[${word.original}]`) // Show missing words in brackets
      incorrectIndices.push(index)
    } else if (word.isExtra) {
      // Skip extra words in display
    } else {
      parts.push(word.original) // Show original, mark as incorrect
      incorrectIndices.push(index)
    }
  })
  
  return {
    displayText: parts.join(' '),
    incorrectIndices,
  }
}

