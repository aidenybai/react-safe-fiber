import React from "react";
import ReactDOM from "react-dom/client";
import "./main.css";

const PROJECT = "mini-react-scan";

export const root = ReactDOM.createRoot(document.getElementById("root"));
const render = async () => {
	let Component;
	if (process.env.NODE_ENV === "production") {
		Component = (await import(/* @vite-ignore */ `./main.jsx`)).default;
	} else {
		Component = (await import(/* @vite-ignore */ `./${PROJECT}.jsx`)).default;
	}
	root.render(<Component />);
};

render();
