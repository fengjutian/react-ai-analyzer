export interface VectorSearchOptions {
  topK?: number
  minScore?: number
}

export interface VectorSearchResult<TMetadata> {
  metadata: TMetadata
  score: number
}

type VectorItem<TMetadata> = {
  vector: number[]
  metadata: TMetadata
  norm: number
}

export class VectorStore<TMetadata = unknown> {
  private readonly store: VectorItem<TMetadata>[] = []
  private dimension: number | null = null

  add(vector: number[], metadata: TMetadata) {
    this.assertVector(vector)
    this.store.push({
      vector,
      metadata,
      norm: this.vectorNorm(vector)
    })
  }

  search(query: number[], options: VectorSearchOptions = {}): VectorSearchResult<TMetadata>[] {
    this.assertVector(query)
    const topK = Math.max(1, options.topK ?? 5)
    const minScore = options.minScore ?? Number.NEGATIVE_INFINITY
    const queryNorm = this.vectorNorm(query)
    if (queryNorm === 0) return []

    return this.store
      .map(item => ({
        metadata: item.metadata,
        score: this.cosineSimilarity(query, queryNorm, item.vector, item.norm)
      }))
      .filter(item => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  size() {
    return this.store.length
  }

  clear() {
    this.store.length = 0
    this.dimension = null
  }

  private assertVector(vector: number[]) {
    if (vector.length === 0) {
      throw new Error("Vector must not be empty")
    }
    if (vector.some(value => !Number.isFinite(value))) {
      throw new Error("Vector contains non-finite values")
    }
    if (this.dimension === null) {
      this.dimension = vector.length
      return
    }
    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`)
    }
  }

  private vectorNorm(vector: number[]) {
    return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  }

  private cosineSimilarity(
    left: number[],
    leftNorm: number,
    right: number[],
    rightNorm: number
  ) {
    if (leftNorm === 0 || rightNorm === 0) return Number.NEGATIVE_INFINITY
    const dotProduct = left.reduce((sum, value, index) => sum + value * right[index], 0)
    return dotProduct / (leftNorm * rightNorm)
  }
}
