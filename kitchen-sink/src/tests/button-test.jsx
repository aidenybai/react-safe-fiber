import * as ReactScanV1 from "bippy/dist/scan/index";
import React, { useState, useEffect } from "react";

export default function Counter() {
	"use scan"
	const [count, setCount] = useState(0);

	useEffect(() => {
		setInterval(() => {
			setCount((count) => count + 1);
		}, 100);
	}, []);

	return <div className="counter">{count}</div>;
}
