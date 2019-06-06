import syllable from 'syllable'
import flesch from 'flesch'

function countWords(content) {
  content = typeof content === 'string' ? content : ''
  return content.split(/\s+/).filter(el => !!el).length
}

function countSentences(content) {
  content = typeof content === 'string' ? content : ''
  return content.split(/[.?!]/).filter(el => !!el).length
}

function Calculate(content) {
  const words = countWords(content)
  const sentences = countSentences(content)
  const syllables = syllable(content)

  const score = flesch({
    word: words,
    sentence: sentences,
    syllable: syllables,
  })

  return (score < 0 ? 0 : score > 100 ? 100 : score).toFixed(1)
}

export default Calculate