import type { Fiber as ReactFiber } from "../index.js";

export type Fiber = ReactFiber<Element>;

export interface OutlineData {
	id: number;
	name: string;
	count: number;
	x: number;
	y: number;
	width: number;
	height: number;
	didCommit: 0 | 1;
}

export type InlineOutlineData = [
	/**
	 * id
	 */
	number,
	/**
	 * count
	 */
	number,
	/**
	 * x
	 */
	number,
	/**
	 * y
	 */
	number,
	/**
	 * width
	 */
	number,
	/**
	 * height
	 */
	number,
	/**
	 * didCommit
	 */
	0 | 1,
];

export interface ActiveOutline {
	id: number;
	name: string;
	count: number;
	x: number;
	y: number;
	width: number;
	height: number;
	targetX: number;
	targetY: number;
	targetWidth: number;
	targetHeight: number;
	frame: number;
	didCommit: 1 | 0;
}

export interface BlueprintOutline {
	name: string;
	count: number;
	elements: Element[];
	didCommit: 1 | 0;
}

export interface InspectState {
	isActive: boolean;
	hoveredRect: DOMRect | null;
	hoveredInfo: {
		tagName: string;
		displayName: string | null;
		key: string | null;
	} | null;
}

declare global {
	var __REACT_SCAN_STOP__: boolean;
	var ReactScan: {
		hasStopped: () => boolean;
		stop: () => void;
		cleanup: () => void;
		init: () => void;
		flushOutlines: () => void;
		toggleInspect: () => void;
	};
}
