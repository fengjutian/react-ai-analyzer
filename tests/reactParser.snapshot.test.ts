import { strict as assert } from "node:assert"
import { analyzeReactCode } from "../analyzer/ast/reactParser"

const sampleCode = `
import React, { useEffect, useState, forwardRef, FC } from "react"
import { Button } from "./Button"

interface UserProps {
  id: string
}

type LocalState = "idle" | "loading"

const Header: FC<UserProps> = ({ id }) => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    console.log(id)
  }, [id])
  return <Button onClick={() => setCount(count + 1)}>{id}</Button>
}

const Input = React.forwardRef<HTMLInputElement, UserProps>((props, ref) => {
  return <input ref={ref} value={props.id} />
})

function helper() {
  return "ok"
}
`

const analysis = analyzeReactCode(sampleCode, "sample.tsx")

assert(analysis.components.includes("Header"), "Header should be a component")
assert(analysis.components.includes("Input"), "Input should be a component")
assert(analysis.fcComponents.includes("Header"), "Header should be detected as React.FC")
assert(analysis.forwardRefComponents.includes("Input"), "Input should be detected as forwardRef")
assert(analysis.interfaces.includes("UserProps"), "UserProps interface should be detected")
assert(analysis.types.includes("LocalState"), "LocalState type should be detected")
assert(analysis.componentImports.includes("Button"), "Button should be detected as imported component")
assert(analysis.functions.includes("helper"), "helper should be detected as function")
assert(analysis.componentDependencies.Header?.includes("./Button"), "Header should depend on ./Button")
assert(analysis.componentProfiles.Header?.hooks.includes("useEffect"), "Header should include useEffect in profile")
assert(analysis.componentProfiles.Header?.stateVariables.includes("count"), "Header should include state variable")
assert(
  analysis.knowledgeTriples.some(
    triple =>
      triple.subject === "Header" &&
      triple.predicate === "depends_on" &&
      triple.object === "./Button"
  ),
  "Knowledge triples should include Header depends_on ./Button"
)

console.log("reactParser snapshot test passed")
