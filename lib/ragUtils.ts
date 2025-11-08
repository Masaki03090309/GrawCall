import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface RAGSection {
  title: string
  content: string
  embedding?: number[]
}

// Global cache for embeddings (loaded once per server lifecycle)
let cachedSections: RAGSection[] | null = null

/**
 * Split markdown file into sections based on ## headings
 */
export function splitMarkdownIntoSections(markdownContent: string): RAGSection[] {
  const lines = markdownContent.split('\n')
  const sections: RAGSection[] = []
  let currentSection: { title: string; content: string[] } | null = null

  for (const line of lines) {
    // Check if line is a ## heading (but not # or ###)
    if (line.match(/^## [^#]/)) {
      // Save previous section if exists
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n').trim(),
        })
      }

      // Start new section
      currentSection = {
        title: line.replace(/^## /, '').trim(),
        content: [],
      }
    } else if (currentSection) {
      // Add line to current section
      currentSection.content.push(line)
    }
  }

  // Save last section
  if (currentSection) {
    sections.push({
      title: currentSection.title,
      content: currentSection.content.join('\n').trim(),
    })
  }

  return sections
}

/**
 * Generate embeddings for sections using OpenAI Embeddings API
 */
export async function generateEmbeddings(sections: RAGSection[]): Promise<RAGSection[]> {
  console.log(`[RAG] Generating embeddings for ${sections.length} sections...`)

  const embeddingsPromises = sections.map(async section => {
    const text = `${section.title}\n\n${section.content}`

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      })

      return {
        ...section,
        embedding: response.data[0].embedding,
      }
    } catch (error) {
      console.error(`[RAG] Error generating embedding for section "${section.title}":`, error)
      return {
        ...section,
        embedding: undefined,
      }
    }
  })

  const sectionsWithEmbeddings = await Promise.all(embeddingsPromises)
  console.log('[RAG] Embeddings generated successfully')

  return sectionsWithEmbeddings
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Search for relevant sections using semantic similarity
 */
export async function searchRAG(
  query: string,
  topK: number = 3,
  similarityThreshold: number = 0.5
): Promise<string[]> {
  // Load and cache sections on first call
  if (!cachedSections) {
    console.log('[RAG] Loading RAG material from file...')

    const filePath = path.join(
      process.cwd(),
      'docs/rag-materials/compass_artifact_wf-265d2811-54ae-48ad-8713-a6bbe0adc4cd_text_markdown.md'
    )

    const markdownContent = fs.readFileSync(filePath, 'utf-8')
    const sections = splitMarkdownIntoSections(markdownContent)

    console.log(`[RAG] Found ${sections.length} sections`)

    cachedSections = await generateEmbeddings(sections)
  }

  // Generate embedding for query
  const queryEmbeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  })

  const queryEmbedding = queryEmbeddingResponse.data[0].embedding

  // Calculate similarity scores
  const sectionsWithScores = cachedSections
    .filter(section => section.embedding !== undefined)
    .map(section => ({
      section,
      score: cosineSimilarity(queryEmbedding, section.embedding!),
    }))
    .filter(item => item.score >= similarityThreshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  console.log(
    `[RAG] Found ${sectionsWithScores.length} relevant sections (threshold: ${similarityThreshold})`
  )
  sectionsWithScores.forEach((item, idx) => {
    console.log(`[RAG] ${idx + 1}. "${item.section.title}" (score: ${item.score.toFixed(3)})`)
  })

  // Return formatted results
  return sectionsWithScores.map(
    item => `【${item.section.title}】\n${item.section.content.substring(0, 500)}...`
  )
}

/**
 * Clear cached sections (useful for development/testing)
 */
export function clearRAGCache(): void {
  cachedSections = null
  console.log('[RAG] Cache cleared')
}
