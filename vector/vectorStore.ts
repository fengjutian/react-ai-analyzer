export class VectorStore {
    private vectors: Map<string, number[]> = new Map();

    public async add(id: string, vector: number[]) {
        this.vectors.set(id, vector);
    }

    public async search(vector: number[], limit: number = 5): Promise<string[]> {
        // Implement cosine similarity search or similar
        return Array.from(this.vectors.keys()).slice(0, limit);
    }

    public clear() {
        this.vectors.clear();
    }
}
