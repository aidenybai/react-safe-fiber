// https://x.com/jjenzz/status/1859954446140334277
import { instrument, getNearestHostFibers, createFiberVisitor } from "bippy"; // must be imported BEFORE react
import * as React from "react";
import * as BippyScan from "bippy/dist/scan/index";

BippyScan;

const mergeRects = (rects) => {
	const left = Math.min(...rects.map((r) => r.left));
	const top = Math.min(...rects.map((r) => r.top));
	const width = Math.max(...rects.map((r) => r.left + r.width)) - left;
	const height = Math.max(...rects.map((r) => r.top + r.height)) - top;
	return { left, top, width, height };
};

const highlightFiber = (fibers) => {
	const rect = mergeRects(
		fibers.map((fiber) => fiber.stateNode.getBoundingClientRect()),
	);
	const highlight = document.createElement("div");
	highlight.style.border = "1px solid red";
	highlight.style.position = "fixed";
	highlight.style.top = `${rect.top}px`;
	highlight.style.left = `${rect.left}px`;
	highlight.style.width = `${rect.width}px`;
	highlight.style.height = `${rect.height}px`;
	highlight.style.zIndex = 999999999;
	document.documentElement.appendChild(highlight);
	setTimeout(() => {
		document.documentElement.removeChild(highlight);
	}, 100);
};

// const visit = createFiberVisitor({
// 	onRender(fiber) {
// 		const hostFibers = getNearestHostFibers(fiber);
// 		highlightFiber(hostFibers);
// 	},
// });

// instrument({
// 	onCommitFiberRoot(rendererID, root) {
// 		visit(rendererID, root);
// 	},
// });

const MyContext = React.createContext(0);

const Provider = ({ children }) => {
	const [count, setCount] = React.useState(0);
	return (
		<MyContext.Provider value={count}>
			{children}
			{/* re-renders bcos it's in the re-rendering owner tree */}
			<button
				type="button"
				onClick={() => setCount((count) => count + 1)}
				style={{ marginTop: 20 }}
			>
				increase
			</button>
		</MyContext.Provider>
	);
};

// re-renders bcos it consumes the context
const Count = () => {
	const count = React.useContext(MyContext);
	return <div>{count}</div>;
};

// does not re-render bcos it's not in the re-rendering
// owner tree. its owner is `App`.
const Title = () => {
	return <h1>Title</h1>;
};

const App = () => (
	<div className="p-10">
		<Provider>
			<Title />
			<Count />
		</Provider>
	</div>
);

export default App;
