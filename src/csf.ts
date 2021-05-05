// Copyright (c) 2014-2018 Anthony Carapetis
// This software is licensed under the MIT license.
// See COPYING for more details.

import { reparametrizedCSF, remesh, clean, removeNodes } from './flow';
import { renderClosedCurve, renderPath } from './graphics';
import { Point, Curve, scale, add, subtract, squaredLength, curvature } from './geometry';
import { LocalFunction } from './CircularList';
import { LitElement, html, property, query, customElement } from 'lit-element';
import interpolate from 'color-interpolate';
import bind from 'bind-decorator';
import fs from 'fs';

const d2 = (a: Point, b: Point) => squaredLength(subtract(a, b));
const dt = 1;

interface PointerInput {
	identifier: number | string;
	clientX: number;
	clientY: number;
	button?: number;
}

function fromMouseEvent(e: MouseEvent): PointerInput {
	return {
		button: e.button,
		clientX: e.clientX,
		clientY: e.clientY,
		identifier: '__mouse__',
	};
}

// Helper method for handling mouse and touch using the same functions
// TODO: are native pointerEvents mature yet?
function eachTouch(handler: (touch: PointerInput) => void): (e: MouseEvent | TouchEvent) => void {
	return (e: MouseEvent | TouchEvent) => {
		if (e instanceof MouseEvent) {
			if (e.button > 0) return;
			return handler(fromMouseEvent(e));
		} else {
			e.preventDefault();
			return Array.from(e.changedTouches).map(handler);
		}
	};
}

const curvatureColor = (k: number) => interpolate(['black', 'red'])(k * 100);

@customElement('csf-app')
class CSFApp extends LitElement {
	touchPaths: Map<number | string, Point[]> = new Map();
	curves: Curve[] = [];
	seglength: number = 5;

	numberIters = 100;

	Coordinates: any[] = [['x', 'y']];
	coordinatesData = '';

	numberOfIters = 0;
	savedTimes = 0;

	@query('canvas') canvas?: HTMLCanvasElement;
	get ctx(): CanvasRenderingContext2D | null {
		return this.canvas ? this.canvas.getContext('2d') : null;
	}

	@property({ type: Number })
	bufferWidth = 300;

	@property({ type: Number })
	bufferHeight = 200;

	@property({ type: Boolean })
	preserveArea = false;

	@property({ type: Boolean })
	colorCode = true;

	@property({ type: Boolean })
	paused = false;

	@property({ type: Boolean })
	saveData = false;

	@property({ type: Number })
	iterations = 5;

	render() {
		return html`
			<style>
				:host {
					position: relative;
				}

				canvas {
					width: 100%;
					height: 100%;
					margin: 0;
					padding: 0;
				}

				#clear {
					position: absolute;
					bottom: 10px;
					left: 10px;
				}
			</style>
			<canvas
				width=${this.bufferWidth}
				height=${this.bufferHeight}
				@mousemove=${eachTouch(this.touchMove)}
				@touchmove=${eachTouch(this.touchMove)}
				@mousedown=${eachTouch(this.touchStart)}
				@touchstart=${eachTouch(this.touchStart)}
				@mouseup=${eachTouch(this.touchEnd)}
				@touchend=${eachTouch(this.touchEnd)}
				@selectstart=${() => false}
			>
			</canvas>
			<button id="clear" @click=${() => (this.curves = [])}>Clear curves</button>
		`;
	}

	firstUpdated() {
		window.addEventListener('resize', this.resize);
		window.addEventListener('orientationchange', this.resize);
		this.resize();
		requestAnimationFrame(this.startFlow); // let resize kick in
	}

	@bind
	startFlow() {
		// this.canvas && this.curves.push(demoCurve(this.canvas));
		this.tick();
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		window.removeEventListener('resize', this.resize);
		window.removeEventListener('orientationchange', this.resize);
	}

	@bind
	resize() {
		// Make sure 1 canvas pixel = 1 screen pixel
		const ctx: any = this.ctx;
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const bsr =
			ctx.webkitBackingStorePixelRatio ||
			ctx.mozBackingStorePixelRatio ||
			ctx.msBackingStorePixelRatio ||
			ctx.oBackingStorePixelRatio ||
			ctx.backingStorePixelRatio ||
			1;
		const PIXEL_RATIO = dpr / bsr;

		this.bufferWidth = (this.canvas && this.canvas.clientWidth * PIXEL_RATIO) || 0;
		this.bufferHeight = (this.canvas && this.canvas.clientHeight * PIXEL_RATIO) || 0;

		// If you have super high dpi then 1. you don't need as many
		// segments/pixel and 2. you're probably running this on a moderately
		// slow ass-phone.
		this.seglength = 5 * PIXEL_RATIO;
	}

	@bind
	touchStart(e: PointerInput) {
		this.touchPaths.set(e.identifier, []);
		this.touchMove(e);
	}

	@bind
	touchMove(e: PointerInput) {
		const path = this.touchPaths.get(e.identifier);
		if (!path) return;

		if (!this.canvas) return;

		const rect = this.canvas.getBoundingClientRect();
		const pos: Point = [
			((e.clientX - rect.left) / (rect.right - rect.left)) * this.canvas.width,
			((e.clientY - rect.top) / (rect.bottom - rect.top)) * this.canvas.height,
		];

		const lastPos = path.length ? path[path.length - 1] : false;

		if (!lastPos || d2(pos, lastPos) > this.seglength ** 2) path.push(pos);
	}

	@bind
	touchEnd(e: PointerInput) {
		const path = this.touchPaths.get(e.identifier);
		if (!path) return;

		let p = path[0];

		while (d2(p, path[path.length - 1]) > this.seglength ** 2) {
			let q = path[path.length - 1];
			let d = subtract(p, q);
			let l = squaredLength(d) ** (1 / 2);
			path.push(add(q, scale(d, this.seglength / l)));
		}

		// add all the points to data
		const data = path.map((item) => [Math.round(item[0]) / 1000, Math.round(item[1]) / 10000]);
		this.coordinatesData += JSON.stringify(data) + '\n\n';

		this.curves.push(new Curve(path));
		this.touchPaths.delete(e.identifier);
	}

	@bind
	tick() {
		this.numberOfIters += 1;
		requestAnimationFrame(this.tick);
		if (this.paused) return;
		const canvas = this.canvas;
		const ctx = this.ctx;
		if (!ctx || !canvas) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = 'black';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		if (this.curves.length == 0 && this.touchPaths.size == 0) {
			ctx.font = '40px MathJax_Main';
			ctx.fillText('Draw a closed curve', canvas.width / 2, 10);
		}

		// If user is currently drawing any curves, show them in grey.
		ctx.fillStyle = 'darkgrey';
		for (let [id, c] of this.touchPaths.entries()) {
			renderPath(c, ctx, 0.25);
		}

		ctx.fillStyle = 'black';

		// Destroy curve if it is too small or curvature is too extreme
		this.curves = this.curves.filter((cu) => cu.length >= 10 && cu.curvature().max() < 4000);

		const inBounds = ([x, y]: Point) => x > 0 && x < canvas.width && y > 0 && y < canvas.height;

		// allData

		for (let [j, cu] of this.curves.entries()) {
			const area = cu.area();

			cu = cu.filter(inBounds);

			// cu.findAngles()
			// removeNodes(cu)

			// Flow
			cu = cu.map(reparametrizedCSF(dt / cu.curvature().max()));

			if (this.preserveArea) {
				// Rescale
				cu = cu.scale(Math.sqrt(area / cu.area()));
			}

			this.curves[j] = cu;

			remesh(cu, this.seglength);
			clean(cu);

			if (this.saveData) {
				// call save data
				// console.log('savedTimes::', this.savedTimes);
				// console.log('this.iterations::', this.iterations);
				// console.log('numberOfIters::', this.numberOfIters);
				if (this.numberOfIters % 50 == 0 && this.savedTimes < this.iterations) {
					this.savedTimes += 1;
					const data = [...cu._data].map((item) => [
						Math.round(item[0]) / 1000,
						Math.round(item[1]) / 10000,
					]);
					this.coordinatesData += JSON.stringify(data) + '%0D%0A%0D%0A';

					if (this.savedTimes == this.iterations) {
						// save data to file
						if (this.saveData) {
							// const blob = new Blob([JSON.stringify(this.coordinatesData)], {
							// 	type: 'application/plain',
							// });
							// const url = URL.createObjectURL(blob);
							// Create a new anchor element
							const a = document.createElement('a');
							a.href = "data:text/plain," + this.coordinatesData;;
							a.download = 'data.txt';
							a.click();
							a.remove();
						}
					}
				}
			}

			const colorFunction: LocalFunction<Point, string> = this.colorCode
				? (p, i, x) => curvatureColor(curvature(x))
				: () => 'black';

			// Render
			renderClosedCurve(cu, ctx, { colorFunction });
		}
	}
}

function demoCurve(canvas: HTMLCanvasElement) {
	// Generate an interesting demo curve to start.
	var N = 200;
	var curve: Point[] = [];
	for (var i = 0; i < N; i++) {
		var x = canvas.width / 2 + canvas.width * (0.05 * Math.cos((2 * Math.PI * i) / N));
		curve.push([
			x + 0.2 * canvas.width * Math.pow(Math.cos((2 * Math.PI * i) / N), 101),
			canvas.height *
				(0.15 +
					0.05 * Math.sin((2 * Math.PI * i) / N) +
					0.05 * Math.sin(x / 5) +
					0.7 * Math.pow(Math.sin((2 * Math.PI * i) / N), 150)),
		]);
	}
	return new Curve(curve);
}
