import Syllable from 'syllable'

const countWords = content => {
  return content.split(/\s+/).length
}

const averageSentenceLength = content => {
  const sentences = content.split(/[\.\?!]+/) || []
  const sentenceCount = sentences.length
  
  let totalWords = 0
  for (let sentence of sentences) {
    totalWords += countWords(sentence)
  }

  return totalWords / sentenceCount
}

const averageSyllablesPerWord = content => {
  const words = content.split(/[^a-z]/i)

  console.log(words)

  return 1
}

export const Calculate = content => {
  return 206.835 - 1.015 * averageSentenceLength(content) - 84.6 * averageSyllablesPerWord(content)
}

/*

The Flesch Reading Ease Readability Formula 

The specific mathematical formula is: 

RE = 206.835 – (1.015 x ASL) – (84.6 x ASW) 

RE = Readability Ease 

ASL = Average Sentence Length (i.e., the number of words divided by the number of sentences) 

ASW = Average number of syllables per word (i.e., the number of syllables divided by the number of words) 

The output, i.e., RE is a number ranging from 0 to 100. The higher the number, the easier the text is to read. 

• Scores between 90.0 and 100.0 are considered easily understandable by an average 5th grader.
• Scores between 60.0 and 70.0 are considered easily understood by 8th and 9th graders.
• Scores between 0.0 and 30.0 are considered easily understood by college graduates.

*/