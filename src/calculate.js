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
  return flesch({sentence: countSentences(content), word: countWords(content), syllable: syllable(content)})
}

export default Calculate