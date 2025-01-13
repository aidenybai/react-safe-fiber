import React from "react";
import {
	instrument,
	createFiberVisitor,
	getDisplayName,
	isCompositeFiber,
} from "bippy";

const visit = createFiberVisitor({
	onRender(fiber) {
		if (isCompositeFiber(fiber)) {
			console.count(`recieved ${getDisplayName(fiber.type)}`);
		}
	},
});

instrument({
	onCommitFiberRoot: (rendererID, fiberRoot) => {
		visit(rendererID, fiberRoot);
	},
});

function PassthroughChildren({ children }) {
	console.count("sent PassthroughChildren");
	return <div>{children}</div>;
}

function BasicComponent() {
	console.count("sent BasicComponent");
	return <div>BasicComponent</div>;
}

export default function ChildrenRenderTest() {
	console.count("sent ChildrenRenderTest");
	return (
		<PassthroughChildren>
			<PassthroughChildren>
				<BasicComponent />
			</PassthroughChildren>
		</PassthroughChildren>
	);
}
