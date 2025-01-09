import React, { useState, createContext } from "react";
import * as BippyScan from "bippy/dist/scan/index";

// const visit = createFiberVisitor({
// 	onRender(fiber) {
// 		// const hostFiber = getNearestHostFiber(fiber);
// 		// highlightFiber(hostFiber);
// 		BippyScan.pushOutline(fiber);
// 	},
// });

// instrument({
// 	onCommitFiberRoot(rendererID, root) {
// 		visit(rendererID, root);
// 	},
// });

console.log(BippyScan);

const TooltipContext = createContext({ tooltip: "" });

export const App = () => {
	const [tasks, setTasks] = useState([]);

	return (
		<TooltipContext.Provider value={{ tooltip: "Hello" }}>
			<div className="p-16 text-xs">
				<div className="main-content">
					<h1 id="btn-block-main-thread">Status: unblocked</h1>
					<br />
					<nav className="navbar">
						<a href="/" className="navbar-brand">
							<h3>
								<strong style={{ fontFamily: "Geist Mono, monospace" }}>
									React Scan
								</strong>
							</h3>
						</a>
					</nav>

					<div className="task-section">
						<AddTaskBar
							onCreate={(value) => {
								if (!value) return;
								setTasks([...tasks, value]);
							}}
						/>
						<TaskList
							tasks={tasks}
							onDelete={(value) =>
								setTasks(tasks.filter((task) => task !== value))
							}
						/>
					</div>
				</div>
			</div>
		</TooltipContext.Provider>
	);
};

export const TaskList = ({ tasks, onDelete }) => {
	return (
		<ul className="mt-4 list-disc pl-4">
			{tasks.map((task) => (
				<TaskItem key={task} task={task} onDelete={onDelete} />
			))}
		</ul>
	);
};

export const TaskItem = ({ task, onDelete }) => {
	const { tooltip } = React.useContext(TooltipContext);
	return (
		<li className="task-item" tooltip={tooltip}>
			{task}
			<Button onClick={() => onDelete(task)}>Delete</Button>
		</li>
	);
};

export const Text = ({ children }) => {
	return <span>{children}</span>;
};

export const Button = ({ onClick, children, id }) => {
	return (
		<button
			id={id}
			type="button"
			className="ml-2 border border-gray-300 bg-black text-white rounded-md p-2"
			onClick={onClick}
		>
			<Text>{children}</Text>
		</button>
	);
};

export const AddTaskBar = ({ onCreate }) => {
	const [value, setValue] = useState("");
	const [id, setId] = useState(0);
	return (
		<div className="add-task-container flex">
			<Input
				onChange={(value) => setValue(value)}
				onEnter={async (value) => {
					onCreate(`${value} (${id})`);
					setValue("");
					setId(id + 1);
					// await new Promise((resolve) => setTimeout(resolve, 0));
					// for (let i = 0; i < 1000000000; i++) {}
				}}
				value={value}
			/>
			<Button
				onClick={async () => {
					onCreate(value);
					setValue("");
					document.getElementById("btn-block-main-thread").textContent =
						"blocked";
					document.getElementById(
						"btn-block-main-thread",
					).style.backgroundColor = "red";
					await new Promise((resolve) => setTimeout(resolve, 0));
					for (let i = 0; i < 1000000000; i++) {}
					console.log("unblocking main thread");
					document.getElementById("btn-block-main-thread").textContent =
						"unblocked";
					document.getElementById(
						"btn-block-main-thread",
					).style.backgroundColor = "lightgreen";
				}}
			>
				Add Task and block main thread
			</Button>
		</div>
	);
};

export const Input = ({ onChange, onEnter, value }) => {
	return (
		<input
			type="text"
			className="border border-gray-300 rounded-md p-2"
			placeholder="Today I will..."
			onChange={(e) => onChange(e.target.value)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					onEnter(e.target.value);
				}
			}}
			value={value}
		/>
	);
};

export default App;
