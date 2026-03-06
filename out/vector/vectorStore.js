"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStore = void 0;
class VectorStore {
    store = [];
    add(vector, metadata) {
        this.store.push({ vector, metadata });
    }
    search(query) {
        return this.store.slice(0, 5).map(x => x.metadata);
    }
}
exports.VectorStore = VectorStore;
//# sourceMappingURL=vectorStore.js.map