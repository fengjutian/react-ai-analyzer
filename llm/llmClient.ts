export async function analyzeWithLLM(context: any) {
  const prompt = `
你是React架构专家。
代码结构：
${JSON.stringify(context, null, 2)}
请分析：
1. 组件职责
2. 性能问题
3. 架构优化建议
`
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    body: JSON.stringify({
      model: "llama3",
      prompt
    })
  })

  return res.json()
}