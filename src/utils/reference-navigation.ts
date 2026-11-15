export function normalizeNavigationPath(path: string): string {
	return path.replace(/\/+$/, "").toLowerCase();
}

export function isNavigationRoute(route: string, current: string): boolean {
	const path = normalizeNavigationPath(route);
	const home = normalizeNavigationPath(import.meta.env.BASE_URL);
	return path === current || (path !== home && current.startsWith(`${path}/`));
}

export function initReferenceNavigation(): void {
	const nav = document.querySelector<HTMLElement>("[data-reference-nav]");
	const slider = nav?.querySelector<HTMLElement>("[data-hover-border]");
	if (!nav || !slider || nav.hasAttribute("data-nav-slider-ready")) return;

	const entries = Array.from(
		nav.querySelectorAll<HTMLElement>(":scope > [data-nav-routes]"),
		(element) => ({
			element,
			trigger: element.querySelector<HTMLElement>(".reference-nav-trigger"),
			menu: element.querySelector<HTMLElement>("[data-dropdown-menu]"),
			links: Array.from(element.querySelectorAll<HTMLAnchorElement>("a[href]")),
			routes: JSON.parse(element.dataset.navRoutes || "[]") as string[],
		}),
	);
	type Entry = (typeof entries)[number];
	let active: Entry | undefined;
	let hovered: Entry | undefined;
	let focused: Entry | undefined;
	let open: Entry | undefined;
	let pinned: Entry | undefined;
	let marked: Entry | undefined;

	function paint() {
		const next = hovered ?? focused ?? open ?? active;
		if (marked !== next) {
			marked?.element.removeAttribute("data-nav-highlighted");
			next?.element.setAttribute("data-nav-highlighted", "");
			marked = next;
		}
		const target = next?.trigger ?? next?.element;
		if (!target || !nav || !slider || nav.clientWidth === 0) {
			slider?.removeAttribute("data-nav-slider-visible");
			return;
		}
		const bounds = target.getBoundingClientRect();
		const origin = nav.getBoundingClientRect();
		slider.style.left = `${bounds.left - origin.left - nav.clientLeft}px`;
		slider.style.top = `${bounds.top - origin.top - nav.clientTop}px`;
		slider.style.width = `${bounds.width}px`;
		slider.style.height = `${bounds.height}px`;
		slider.setAttribute("data-nav-slider-visible", "");
	}

	function setOpen(next?: Entry) {
		if (open === next) return;
		if (open?.menu) {
			open.menu.inert = true;
			open.element.removeAttribute("data-nav-menu-open");
			open.trigger?.setAttribute("aria-expanded", "false");
		}
		open = next?.menu ? next : undefined;
		if (open?.menu) {
			open.menu.inert = false;
			open.element.setAttribute("data-nav-menu-open", "");
			open.trigger?.setAttribute("aria-expanded", "true");
		}
	}

	function syncRoute() {
		const current = normalizeNavigationPath(location.pathname);
		let best = -1;
		active = undefined;
		for (const entry of entries) {
			for (const route of entry.routes) {
				if (isNavigationRoute(route, current) && route.length > best) {
					best = route.length;
					active = entry;
				}
			}
			for (const link of entry.links) {
				if (
					link.origin === location.origin &&
					normalizeNavigationPath(link.pathname) === current &&
					!link.target
				) {
					link.setAttribute("aria-current", "page");
				} else {
					link.removeAttribute("aria-current");
				}
			}
		}
		for (const entry of entries) {
			entry.element.toggleAttribute("data-nav-active", entry === active);
		}
		paint();
	}

	for (const entry of entries) {
		entry.element.addEventListener("pointerenter", (event) => {
			if (event.pointerType === "touch") return;
			if (hovered !== entry && pinned !== entry) pinned = undefined;
			hovered = entry;
			setOpen(entry);
			paint();
		});

		entry.element.addEventListener("focusin", (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			focused =
				target.matches(":focus-visible") || entry.menu?.contains(target)
					? entry
					: undefined;
			if (open !== entry && focused) {
				pinned = undefined;
				setOpen();
			}
			paint();
		});

		if (!entry.menu || !entry.trigger) continue;
		const trigger = entry.trigger;
		trigger.addEventListener("click", () => {
			// Hover previews the menu; a click can keep that disclosure open.
			pinned =
				open === entry && (pinned === entry || hovered !== entry)
					? undefined
					: entry;
			setOpen(pinned);
			paint();
		});
		entry.element.addEventListener("keydown", (event) => {
			if (event.key === "Escape" && open === entry) {
				event.preventDefault();
				trigger.focus();
				pinned = undefined;
				setOpen();
				paint();
				return;
			}
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
			if (!entry.links.length) return;
			event.preventDefault();
			setOpen(entry);
			const index =
				event.target instanceof HTMLAnchorElement
					? entry.links.indexOf(event.target)
					: -1;
			const step = event.key === "ArrowDown" ? 1 : -1;
			const next =
				index === -1 && step < 0
					? entry.links.length - 1
					: (index + step + entry.links.length) % entry.links.length;
			entry.links[next]?.focus();
		});
	}

	nav.addEventListener("pointerleave", () => {
		hovered = undefined;
		if (!pinned && !open?.menu?.contains(document.activeElement)) setOpen();
		paint();
	});
	nav.addEventListener("focusout", (event) => {
		if (
			event.relatedTarget instanceof Node &&
			nav.contains(event.relatedTarget)
		)
			return;
		focused = undefined;
		pinned = undefined;
		if (!hovered) setOpen();
		paint();
	});
	document.addEventListener("pointerdown", (event) => {
		if (event.target instanceof Node && nav.contains(event.target)) return;
		hovered = focused = pinned = undefined;
		setOpen();
		paint();
	});
	document.addEventListener("swup:page:view", () => {
		hovered = focused = pinned = undefined;
		setOpen();
		syncRoute();
	});

	syncRoute();
	nav.setAttribute("data-nav-slider-ready", "");
	const observer = new ResizeObserver(paint);
	observer.observe(nav);
	for (const { element } of entries) observer.observe(element);
}
