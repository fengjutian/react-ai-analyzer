export interface ComponentProfile {
  props: string[]
  hooks: string[]
  stateVariables: string[]
  dependencies: string[]
}

export interface KnowledgeTriple {
  subject: string
  predicate: string
  object: string
}

export interface AnalysisResult {
  components: string[]
  forwardRefComponents: string[]
  fcComponents: string[]
  componentImports: string[]
  componentDependencies: Record<string, string[]>
  componentProfiles: Record<string, ComponentProfile>
  knowledgeTriples: KnowledgeTriple[]
  hooks: string[]
  imports: string[]
  importSpecifiers: string[]
  exports: string[]
  interfaces: string[]
  types: string[]
  props: string[]
  functions: string[]
  methods: string[]
  stateVariables: string[]
  jsxElements: string[]
  jsxAttributes: string[]
}

export interface WorkspaceIndexResult {
  fileCount: number
  componentCount: number
  interfaceCount: number
  typeCount: number
  componentImportCount: number
  componentsByFile: Record<string, string[]>
  dependenciesByFile: Record<string, Record<string, string[]>>
  interfacesByFile: Record<string, string[]>
  typesByFile: Record<string, string[]>
}
