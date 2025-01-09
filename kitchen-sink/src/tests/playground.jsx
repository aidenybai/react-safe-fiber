import React, { useState } from "react";
import {
	Sandpack,
	SandpackLayout,
	SandpackCodeEditor,
	SandpackPreview,
} from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";

export default function Playground() {
	return (
		<Sandpack
			template="react"
			options={{
				showLineNumbers: false, // default - true
				showInlineErrors: true, // default - false
				wrapContent: true, // default - false
				editorHeight: 500, // default - 300
				editorWidthPercentage: 60, // default - 50
			}}
			style={{ fontSize: 18 }}
			showOpenInCodeSandbox={false}
			theme={amethyst}
		/>
	);
}
