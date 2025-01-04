import {
	createFiberVisitor,
	didFiberCommit,
	getDisplayName,
	getFiberId,
	getNearestHostFibers,
	instrument,
	isCompositeFiber,
	secure,
} from "../index.js";
import type {
	Fiber,
	BlueprintOutline,
	ActiveOutline,
	OutlineData,
	InspectState,
} from "./types.js";
// @ts-expect-error OK
import OffscreenCanvasWorker from "./offscreen-canvas.worker.js";
import {
	drawCanvas,
	updateOutlines,
	updateScroll,
	initCanvas,
	OUTLINE_ARRAY_SIZE,
	INSPECT_CURSOR,
	DEFAULT_CURSOR,
} from "./canvas.js";
import { getFiberFromHostInstance } from "../core.js";

let worker: OffscreenCanvasWorker | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;
let animationFrameId: number | null = null;
const activeOutlines = new Map<string, ActiveOutline>();

const blueprintMap = new WeakMap<Fiber, BlueprintOutline>();
const blueprintMapKeys = new Set<Fiber>();

const inspectState: InspectState = {
	isActive: false,
	hoveredRect: null,
	hoveredInfo: null
};

const TOGGLE_BUTTON_HTML = `
	<button
		style="
			position: fixed;
			bottom: 16px;
			right: 16px;
			z-index: 2147483647;
			padding: 8px 12px;
			border: none;
			border-radius: 4px;
			background: rgba(115,97,230,0.9);
			color: white;
			font-family: system-ui;
			font-size: 13px;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 6px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		"
		aria-label="Toggle React element inspector"
	>
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
			<path d="M2 8L6 12L14 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
		</svg>
		Inspect
	</button>
`;

export const toggleInspectMode = (enable?: boolean) => {
	if (!canvas) return;

	inspectState.isActive = enable ?? !inspectState.isActive;
	canvas.style.cursor = inspectState.isActive ? INSPECT_CURSOR : DEFAULT_CURSOR;

	// Reset frame counters when inspect mode is enabled
	if (inspectState.isActive) {
		for (const outline of activeOutlines.values()) {
			outline.frame = 0;
		}
		document.addEventListener("mouseover", handleInspectHover, true);
		document.addEventListener("click", handleInspectClick, true);
	} else {
		document.removeEventListener("mouseover", handleInspectHover, true);
		document.removeEventListener("click", handleInspectClick, true);
	}
};

const handleInspectHover = (e: MouseEvent) => {
	e.stopPropagation();
	const target = e.target as Element;

	// Don't highlight our own canvas
	if (target.closest("[data-react-scan]")) return;

	const fiber = getFiberFromHostInstance(target);
	const rect = target.getBoundingClientRect();

	inspectState.hoveredRect = rect;
	inspectState.hoveredInfo = fiber ? {
		tagName: target.tagName.toLowerCase(),
		displayName: typeof fiber.type === "string" ? fiber.type : getDisplayName(fiber),
		key: fiber.key as string | null
	} : null;

	// Force a redraw to show highlight
	if (worker) {
		worker.postMessage({
			type: "inspect-update",
			isActive: inspectState.isActive,
			hoveredRect: {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height
			},
			hoveredInfo: inspectState.hoveredInfo
		});
	} else if (!animationFrameId) {
		animationFrameId = requestAnimationFrame(draw);
	}
};

const handleInspectClick = (e: MouseEvent) => {
	e.preventDefault();
	e.stopPropagation();

	// Get the target element directly from the event
	const target = e.target as Element;
	if (!target || target.closest("[data-react-scan]")) return;

	const fiber = getFiberFromHostInstance(target);
	if (fiber) {
		console.log("Selected Fiber:", fiber);
		// Here you can add custom handling of the selected fiber
	}
};

export const outlineFiber = (fiber: Fiber) => {
	if (!isCompositeFiber(fiber)) return;
	const name =
		typeof fiber.type === "string" ? fiber.type : getDisplayName(fiber);
	if (!name) return;
	const blueprint = blueprintMap.get(fiber);
	const nearestFibers = getNearestHostFibers(fiber);
	const didCommit = didFiberCommit(fiber);

	if (!blueprint) {
		blueprintMap.set(fiber, {
			name,
			count: 1,
			elements: nearestFibers.map((fiber) => fiber.stateNode),
			didCommit: didCommit ? 1 : 0,
		});
		blueprintMapKeys.add(fiber);
	} else {
		blueprint.count++;
	}
};

const mergeRects = (rects: DOMRect[]) => {
	const firstRect = rects[0];
	if (rects.length === 1) return firstRect;

	let minX: number | undefined;
	let minY: number | undefined;
	let maxX: number | undefined;
	let maxY: number | undefined;

	for (let i = 0, len = rects.length; i < len; i++) {
		const rect = rects[i];
		minX = minX == null ? rect.x : Math.min(minX, rect.x);
		minY = minY == null ? rect.y : Math.min(minY, rect.y);
		maxX =
			maxX == null ? rect.x + rect.width : Math.max(maxX, rect.x + rect.width);
		maxY =
			maxY == null
				? rect.y + rect.height
				: Math.max(maxY, rect.y + rect.height);
	}

	if (minX == null || minY == null || maxX == null || maxY == null) {
		return rects[0];
	}

	return new DOMRect(minX, minY, maxX - minX, maxY - minY);
};

export const getRectMap = (
	elements: Element[],
): Promise<Map<Element, DOMRect>> => {
	return new Promise((resolve) => {
		const rects = new Map<Element, DOMRect>();
		const observer = new IntersectionObserver((entries) => {
			for (let i = 0, len = entries.length; i < len; i++) {
				const entry = entries[i];
				const element = entry.target;
				const rect = entry.boundingClientRect;
				if (entry.isIntersecting && rect.width && rect.height) {
					rects.set(element, rect);
				}
			}
			observer.disconnect();
			resolve(rects);
		});

		for (let i = 0, len = elements.length; i < len; i++) {
			const element = elements[i];
			observer.observe(element);
		}
	});
};

const SupportedArrayBuffer =
	typeof SharedArrayBuffer !== "undefined" ? SharedArrayBuffer : ArrayBuffer;

export const flushOutlines = async () => {
	const elements: Element[] = [];

	for (const fiber of blueprintMapKeys) {
		const blueprint = blueprintMap.get(fiber);
		if (!blueprint) continue;
		for (let i = 0; i < blueprint.elements.length; i++) {
			elements.push(blueprint.elements[i]);
		}
	}

	const rectsMap = await getRectMap(elements);

	const blueprints: BlueprintOutline[] = [];
	const blueprintRects: DOMRect[] = [];
	const blueprintIds: number[] = [];

	for (const fiber of blueprintMapKeys) {
		const blueprint = blueprintMap.get(fiber);
		if (!blueprint) continue;
		const rects: DOMRect[] = [];
		for (let i = 0; i < blueprint.elements.length; i++) {
			const element = blueprint.elements[i];
			const rect = rectsMap.get(element);
			if (!rect) continue;
			rects.push(rect);
		}
		blueprintMap.delete(fiber);
		blueprintMapKeys.delete(fiber);
		if (!rects.length) continue;
		blueprints.push(blueprint);
		blueprintRects.push(mergeRects(rects));
		blueprintIds.push(getFiberId(fiber));
	}

	const arrayBuffer = new SupportedArrayBuffer(
		blueprints.length * OUTLINE_ARRAY_SIZE * 4,
	);
	const sharedView = new Float32Array(arrayBuffer);
	const blueprintNames = new Array(blueprints.length);
	let outlineData: OutlineData[] | undefined;

	for (let i = 0, len = blueprints.length; i < len; i++) {
		const blueprint = blueprints[i];
		const id = blueprintIds[i];
		const { x, y, width, height } = blueprintRects[i];
		const { count, name, didCommit } = blueprint;

		if (worker) {
			const scaledIndex = i * OUTLINE_ARRAY_SIZE;
			sharedView[scaledIndex] = id;
			sharedView[scaledIndex + 1] = count;
			sharedView[scaledIndex + 2] = x;
			sharedView[scaledIndex + 3] = y;
			sharedView[scaledIndex + 4] = width;
			sharedView[scaledIndex + 5] = height;
			sharedView[scaledIndex + 6] = didCommit;
			blueprintNames[i] = name;
		} else {
			outlineData ||= new Array(blueprints.length);
			outlineData[i] = {
				id,
				name,
				count,
				x,
				y,
				width,
				height,
				didCommit: didCommit as 0 | 1,
			};
		}
	}

	if (worker) {
		worker.postMessage({
			type: "draw-outlines",
			data: arrayBuffer,
			names: blueprintNames,
		});
	} else if (canvas && ctx && outlineData) {
		updateOutlines(activeOutlines, outlineData);
		if (!animationFrameId) {
			animationFrameId = requestAnimationFrame(draw);
		}
	}
};

const draw = () => {
	if (!ctx || !canvas) return;

	const shouldContinue = drawCanvas(
		ctx,
		canvas,
		dpr,
		activeOutlines,
		inspectState,
	);

	if (shouldContinue) {
		animationFrameId = requestAnimationFrame(draw);
	} else {
		animationFrameId = null;
	}
};

const CANVAS_HTML_STR = `<canvas style="position:fixed;top:0;left:0;pointer-events:none;z-index:2147483646" aria-hidden="true"></canvas>`;

const IS_OFFSCREEN_CANVAS_WORKER_SUPPORTED =
	typeof OffscreenCanvas !== "undefined" &&
	typeof OffscreenCanvasWorker !== "undefined";

const getDpr = () => {
	return Math.min(window.devicePixelRatio || 1, 2);
};

export const getCanvasEl = () => {
	const host = document.createElement("div");
	host.setAttribute("data-react-scan", "true");
	const shadowRoot = host.attachShadow({ mode: "open" });

	shadowRoot.innerHTML = CANVAS_HTML_STR + TOGGLE_BUTTON_HTML;
	const canvasEl = shadowRoot.querySelector("canvas");
	const toggleButton = shadowRoot.querySelector("button");
	if (!canvasEl) return null;

	dpr = getDpr();
	canvas = canvasEl;

	const { innerWidth, innerHeight } = window;
	canvasEl.style.width = `${innerWidth}px`;
	canvasEl.style.height = `${innerHeight}px`;
	const width = innerWidth * dpr;
	const height = innerHeight * dpr;
	canvasEl.width = width;
	canvasEl.height = height;

	if (IS_OFFSCREEN_CANVAS_WORKER_SUPPORTED) {
		try {
			worker = OffscreenCanvasWorker();
			const offscreenCanvas = canvasEl.transferControlToOffscreen();

			worker.postMessage(
				{
					type: "init",
					canvas: offscreenCanvas,
					width: canvasEl.width,
					height: canvasEl.height,
					dpr,
				},
				[offscreenCanvas],
			);
		} catch {}
	}

	if (!worker) {
		ctx = initCanvas(canvasEl, dpr) as CanvasRenderingContext2D;
	}

	let isResizeScheduled = false;
	window.addEventListener("resize", () => {
		if (!isResizeScheduled) {
			isResizeScheduled = true;
			setTimeout(() => {
				const width = window.innerWidth;
				const height = window.innerHeight;
				dpr = getDpr();
				canvasEl.style.width = `${width}px`;
				canvasEl.style.height = `${height}px`;
				if (worker) {
					worker.postMessage({
						type: "resize",
						width,
						height,
						dpr,
					});
				} else {
					canvasEl.width = width * dpr;
					canvasEl.height = height * dpr;
					if (ctx) {
						ctx.resetTransform();
						ctx.scale(dpr, dpr);
					}
					draw();
				}
				isResizeScheduled = false;
			});
		}
	});

	let prevScrollX = window.scrollX;
	let prevScrollY = window.scrollY;
	let isScrollScheduled = false;

	window.addEventListener("scroll", () => {
		if (!isScrollScheduled) {
			isScrollScheduled = true;
			setTimeout(() => {
				const { scrollX, scrollY } = window;
				const deltaX = scrollX - prevScrollX;
				const deltaY = scrollY - prevScrollY;
				prevScrollX = scrollX;
				prevScrollY = scrollY;
				if (worker) {
					worker.postMessage({
						type: "scroll",
						deltaX,
						deltaY,
					});
				} else {
					requestAnimationFrame(() => {
						updateScroll(activeOutlines, deltaX, deltaY);
					});
				}
				isScrollScheduled = false;
			}, 16 * 2);
		}
	});

	setInterval(() => {
		if (blueprintMapKeys.size) {
			flushOutlines();
		}
	}, 16 * 2);

	window.addEventListener("keydown", (e) => {
		if (e.altKey && e.key.toLowerCase() === "i") {
			toggleInspectMode();
		}
	});

	toggleButton?.addEventListener("click", () => {
		toggleInspectMode();
		if (inspectState.isActive) {
			toggleButton.style.background = "rgba(239,68,68,0.9)";
		} else {
			toggleButton.style.background = "rgba(115,97,230,0.9)";
		}
	});

	shadowRoot.appendChild(canvasEl);
	return host;
};

export const hasStopped = () => {
	return globalThis.__REACT_SCAN_STOP__;
};

export const stop = () => {
	globalThis.__REACT_SCAN_STOP__ = true;
	cleanup();
};

let hasCleanedUp = false;
export const cleanup = () => {
	if (hasCleanedUp) return;
	hasCleanedUp = true;
	toggleInspectMode(false);
	const host = document.querySelector("[data-react-scan]");
	if (host) {
		const button = host.shadowRoot?.querySelector("button");
		if (button) {
			button.style.background = "rgba(115,97,230,0.9)";
		}
		host.remove();
	}
};

const init = () => {
	cleanup();
	if (hasStopped()) return;
	const visit = createFiberVisitor({
		onRender(fiber) {
			if (document.hidden) return;
			outlineFiber(fiber);
		},
		onError() {},
	});

	instrument(
		secure(
			{
				onActive() {
					if (hasStopped()) return;
					const host = getCanvasEl();
					if (host) {
						document.documentElement.appendChild(host);
					}
				},
				onCommitFiberRoot(rendererID, root) {
					if (hasStopped()) return cleanup();
					visit(rendererID, root);
				},
			},
			{
				dangerouslyRunInProduction: true,
				onError(error) {
					console.warn(
						"React Scan did not install correctly.\n\n{link to install doc}",
						error,
					);
				},
			},
		),
	);
};

if (typeof window !== "undefined") {
	init();
	// Add inspect toggle to global ReactScan object
	globalThis.ReactScan = {
		...globalThis.ReactScan,
		toggleInspect: toggleInspectMode,
	};
}
