// Falling drops, edge collisions and splash particles adapted from dumplingandcakeblog (MIT).
type RainDrop = {
	x: number;
	y: number;
	radius: number;
	speed: number;
	tail: number;
	opacity: number;
};
type Splash = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	duration: number;
	radius: number;
};
type Edge = { left: number; right: number; y: number };

export function attachHeroMotion(hero: HTMLElement): () => void {
	const canvas = hero.querySelector<HTMLCanvasElement>(".field-hero-rain");
	const rainAllowed = matchMedia(
		"(min-width: 769px) and (prefers-reduced-motion: no-preference)",
	);
	const rainSurfaces = hero.querySelectorAll<HTMLElement>(
		".home-viewfinder-corner, .field-hero-dialogue",
	);
	const drops: RainDrop[] = [];
	const splashes: Splash[] = [];
	let context: CanvasRenderingContext2D | null | undefined;
	let edges: Edge[] = [];
	let frameId = 0;
	let previousTime = 0;
	let width = 0;
	let height = 0;
	let intersecting = false;
	let geometryDirty = true;

	function makeDrop(y: number): RainDrop {
		return {
			x: Math.random() * width,
			y,
			radius: 0.9 + Math.random() * 1.4,
			speed: 2.4 + Math.random() * 3.2,
			tail: 9 + Math.random() * 16,
			opacity: 0.12 + Math.random() * 0.2,
		};
	}

	function measure() {
		if (!canvas || !context) return;
		const rect = hero.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		if (rect.width !== width || rect.height !== height) {
			width = rect.width;
			height = rect.height;
			const dpr = Math.min(
				devicePixelRatio || 1,
				1.5,
				Math.sqrt(3200000 / (width * height)),
			);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			context.setTransform(
				canvas.width / width,
				0,
				0,
				canvas.height / height,
				0,
				0,
			);
			drops.length = 0;
			splashes.length = 0;
			const count = Math.round(44 * Math.min(1, width / 1280));
			for (let i = 0; i < count; i++)
				drops.push(makeDrop(Math.random() * height));
		}
		edges = Array.from(rainSurfaces)
			.map((surface) => surface.getBoundingClientRect())
			.filter((surface) => surface.width >= 2 && surface.height >= 2)
			.map((surface) => ({
				left: surface.left - rect.left,
				right: surface.right - rect.left,
				y: surface.top - rect.top,
			}))
			.sort((a, b) => a.y - b.y);
		geometryDirty = false;
	}

	function scatter(x: number, y: number) {
		const count = Math.min(
			90 - splashes.length,
			6 + Math.floor(Math.random() * 4),
		);
		for (let i = 0; i < count; i++) {
			const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
			const speed = 1.1 + Math.random() * 2.2;
			splashes.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
				life: 0,
				duration: 22 + Math.random() * 16,
				radius: 0.8 + Math.random() * 1.1,
			});
		}
	}

	function draw(time: number) {
		if (!context) return;
		frameId = requestAnimationFrame(draw);
		const elapsed = previousTime ? time - previousTime : 1000 / 60;
		// Cap redraws at roughly 60 fps, including on high refresh rate displays.
		if (elapsed < 15) return;
		previousTime = time;
		if (geometryDirty) measure();
		const step = Math.min(elapsed * 0.06, 2);
		const ctx = context;
		ctx.clearRect(0, 0, width, height);
		const color = document.documentElement.classList.contains("dark")
			? "255, 255, 255"
			: "70, 78, 90";

		for (const drop of drops) {
			const oldY = drop.y;
			drop.y += drop.speed * step;
			const edge = edges.find(
				({ left, right, y }) =>
					oldY < y && drop.y >= y && drop.x >= left && drop.x <= right,
			);
			if (edge || drop.y >= height) {
				scatter(drop.x, edge?.y ?? height - 1);
				Object.assign(drop, makeDrop(-40 * Math.random()));
				continue;
			}
			ctx.strokeStyle = `rgba(${color}, ${drop.opacity})`;
			ctx.lineWidth = drop.radius;
			ctx.beginPath();
			ctx.moveTo(drop.x, drop.y - drop.tail);
			ctx.lineTo(drop.x, drop.y);
			ctx.stroke();
			ctx.fillStyle = `rgba(${color}, ${Math.min(0.5, drop.opacity + 0.18)})`;
			ctx.beginPath();
			ctx.arc(drop.x, drop.y, drop.radius * 0.9, 0, Math.PI * 2);
			ctx.fill();
		}

		for (let i = splashes.length - 1; i >= 0; i--) {
			const splash = splashes[i];
			splash.life += step;
			if (splash.life >= splash.duration) {
				splashes.splice(i, 1);
				continue;
			}
			splash.vy += 0.16 * step;
			splash.x += splash.vx * step;
			splash.y += splash.vy * step;
			ctx.fillStyle = `rgba(${color}, ${0.4 * (1 - splash.life / splash.duration)})`;
			ctx.beginPath();
			ctx.arc(splash.x, splash.y, splash.radius, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function pause() {
		if (frameId) cancelAnimationFrame(frameId);
		frameId = 0;
		previousTime = 0;
	}

	function sync() {
		const visible = intersecting && document.visibilityState === "visible";
		hero.toggleAttribute("data-hero-visible", visible);
		if (!canvas || !visible || !rainAllowed.matches) {
			pause();
			return;
		}
		if (context === undefined) context = canvas.getContext("2d");
		if (context && !frameId) {
			geometryDirty = true;
			frameId = requestAnimationFrame(draw);
		}
	}

	const intersection = new IntersectionObserver(
		([entry]) => {
			intersecting = entry.isIntersecting && entry.intersectionRatio >= 0.02;
			sync();
		},
		{ threshold: 0.02 },
	);
	const resize = new ResizeObserver(() => {
		geometryDirty = true;
	});
	intersection.observe(hero);
	resize.observe(hero);
	for (const surface of rainSurfaces) resize.observe(surface);
	rainAllowed.addEventListener("change", sync);
	document.addEventListener("visibilitychange", sync);

	return () => {
		pause();
		hero.removeAttribute("data-hero-visible");
		intersection.disconnect();
		resize.disconnect();
		rainAllowed.removeEventListener("change", sync);
		document.removeEventListener("visibilitychange", sync);
	};
}
