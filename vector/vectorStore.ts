export class VectorStore {
  private store: { vector: number[], metadata: any }[] = []

  add(vector: number[], metadata: any) {
    this.store.push({ vector, metadata })
  }

  search(query: number[]): any[] {
    return this.store.slice(0, 5).map(x => x.metadata)
  }
}