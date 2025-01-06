import React from "react";
import {
	instrument,
	createFiberVisitor,
	getDisplayName,
	isCompositeFiber,
} from "bippy";

const visit = createFiberVisitor({
	onRender(fiber) {
		// if (isCompositeFiber(fiber)) {
		console.log(fiber);
		console.count(`recieved ${getDisplayName(fiber.type)}`);
		// }
	},
});

instrument({
	onCommitFiberRoot: (rendererID, fiberRoot) => {
		visit(rendererID, fiberRoot);
	},
});

const CountContext = React.createContext(0);
const ExtraContext = React.createContext(0);

function ComplexComponent({ countProp }) {
	console.count("sent ComplexComponent");
	return <div>ComplexComponent</div>;
}

export default function MultiProviderTest() {
	console.count("sent MultiProviderTest");
	return (
		<CountContext.Provider value={5}>
			<ExtraContext.Provider value={10}>
				<ComplexComponent countProp={2} />
			</ExtraContext.Provider>
		</CountContext.Provider>
	);
}
