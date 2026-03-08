"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const reactParser_1 = require("../analyzer/ast/reactParser");
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
`;
const analysis = (0, reactParser_1.analyzeReactCode)(sampleCode, "sample.tsx");
(0, node_assert_1.strict)(analysis.components.includes("Header"), "Header should be a component");
(0, node_assert_1.strict)(analysis.components.includes("Input"), "Input should be a component");
(0, node_assert_1.strict)(analysis.fcComponents.includes("Header"), "Header should be detected as React.FC");
(0, node_assert_1.strict)(analysis.forwardRefComponents.includes("Input"), "Input should be detected as forwardRef");
(0, node_assert_1.strict)(analysis.interfaces.includes("UserProps"), "UserProps interface should be detected");
(0, node_assert_1.strict)(analysis.types.includes("LocalState"), "LocalState type should be detected");
(0, node_assert_1.strict)(analysis.componentImports.includes("Button"), "Button should be detected as imported component");
(0, node_assert_1.strict)(analysis.functions.includes("helper"), "helper should be detected as function");
(0, node_assert_1.strict)(analysis.componentDependencies.Header?.includes("./Button"), "Header should depend on ./Button");
(0, node_assert_1.strict)(analysis.componentProfiles.Header?.hooks.includes("useEffect"), "Header should include useEffect in profile");
(0, node_assert_1.strict)(analysis.componentProfiles.Header?.stateVariables.includes("count"), "Header should include state variable");
(0, node_assert_1.strict)(analysis.knowledgeTriples.some(triple => triple.subject === "Header" &&
    triple.predicate === "depends_on" &&
    triple.object === "./Button"), "Knowledge triples should include Header depends_on ./Button");
console.log("reactParser snapshot test passed");
//# sourceMappingURL=reactParser.snapshot.test.js.map