<script lang="ts">
import { onMount, tick } from "svelte";
import ClientPagination from "@/components/common/ClientPagination.svelte";
import { formatTimezoneOffset } from "@/utils/date-utils";
import { fetchMemos } from "@/utils/memos-adapter";
import { registerDynamicGallery } from "./dynamic-gallery";
import { registerDynamicInlineComments } from "./dynamic-inline-comments";

type DynamicImage = {
	alt: string;
	src: string;
	title?: string;
};

type DynamicData = {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
	pinned?: boolean;
	location?: string;
	tags?: string[];
};

interface MemosConfig {
	enable: boolean;
	apiUrl: string;
	parent?: string;
}

interface Props {
	source: string;
	itemsPerPage: number;
	showComments: boolean;
	emptyText: string;
	noResultsText: string;
	loadingText: string;
	allYearsText: string;
	timezone: string;
	memos?: MemosConfig;
}

const {
	source,
	itemsPerPage,
	showComments,
	emptyText,
	noResultsText,
	loadingText,
	allYearsText,
	timezone,
	memos,
}: Props = $props();

let entries = $state<DynamicData[]>([]);
let filtered = $state<DynamicData[]>([]);
let currentPage = $state(1);
let loading = $state(true);
let failed = $state(false);
let templateReady = $state(false);
let list: HTMLElement;
let template: HTMLTemplateElement | null = null;
let searchInput: HTMLInputElement | null = null;
let yearSelect: HTMLSelectElement | null = null;
let restoreAnchorAfterRender = false;
let selectedDay = "";
let selectedTag = "";
let month = new Date();
let filterPanel: HTMLElement | null = null;

function dateKey(date: Date) {
	if (!source.startsWith("http") && !memos?.enable) return date.toISOString().slice(0, 10);
	return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
		.map((part) => String(part).padStart(2, "0")).join("-");
}

function tagButton(tag: string, count?: number) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "wx-tag";
	button.dataset.dynamicTag = tag;
	button.setAttribute("aria-pressed", String(selectedTag === tag));
	button.classList.toggle("is-active", selectedTag === tag);
	button.textContent = `#${tag}`;
	if (count !== undefined) {
		const detail = document.createElement("span");
		detail.className = "wx-tag__count";
		detail.textContent = String(count);
		button.append(detail);
	}
	return button;
}

function populateTags() {
	const list = filterPanel?.querySelector("[data-dynamic-tags]");
	const panel = filterPanel?.querySelector<HTMLElement>("[data-dynamic-tag-panel]");
	if (!list || !panel) return;
	const counts = new Map<string, number>();
	for (const entry of entries) {
		for (const tag of new Set(entry.tags ?? [])) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	list.replaceChildren(...[...counts].sort((a, b) => b[1] - a[1]).map(([tag, count]) => tagButton(tag, count)));
	panel.hidden = counts.size === 0;
}

function refreshCalendar() {
	const grid = filterPanel?.querySelector("[data-dynamic-calendar]");
	const title = filterPanel?.querySelector("[data-dynamic-month]");
	if (!grid || !title) return;
	const year = month.getFullYear();
	const monthIndex = month.getMonth();
	const today = new Date();
	const distinctDays = new Set(entries.map(({ published }) => dateKey(new Date(published))));
	const firstWeekday = new Date(year, monthIndex, 1).getDay();
	const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
	const prefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}-`;
	title.textContent = `${year} 年 ${monthIndex + 1} 月`;
	grid.replaceChildren();
	for (let i = 0; i < firstWeekday; i++) {
		const blank = document.createElement("span");
		blank.className = "wx-cal__cell is-empty";
		grid.append(blank);
	}
	for (let day = 1; day <= daysInMonth; day++) {
		const key = prefix + String(day).padStart(2, "0");
		const cell = document.createElement("button");
		cell.type = "button";
		cell.className = "wx-cal__cell";
		cell.classList.toggle("is-today", year === today.getFullYear() && monthIndex === today.getMonth() && day === today.getDate());
		cell.classList.toggle("has-moments", distinctDays.has(key));
		cell.classList.toggle("is-active", selectedDay === key);
		cell.disabled = !distinctDays.has(key);
		cell.dataset.dynamicDay = key;
		cell.textContent = String(day);
		cell.setAttribute("aria-label", key);
		cell.setAttribute("aria-pressed", String(selectedDay === key));
		grid.append(cell);
	}
}

const pageEntries = $derived(
	filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
);

function pageFromUrl() {
	return Math.max(
		1,
		Number(new URL(window.location.href).searchParams.get("page")) || 1,
	);
}

function updateUrl(clearHash = false) {
	const current = new URL(window.location.href);
	if (currentPage > 1) current.searchParams.set("page", String(currentPage));
	else current.searchParams.delete("page");
	if (clearHash) current.hash = "";
	history.replaceState(history.state, "", current);
}

function applyFilters(resetPage = true) {
	const query = searchInput?.value.toLocaleLowerCase().trim() || "";
	const year = yearSelect?.value || "all";
	filtered = entries.filter(
		(entry) =>
			(year === "all" ||
				String(new Date(entry.published).getUTCFullYear()) === year) &&
			(!selectedDay || dateKey(new Date(entry.published)) === selectedDay) &&
			(!selectedTag || (entry.tags ?? []).includes(selectedTag)) &&
			(!query || entry.searchText.includes(query)),
	);
	if (resetPage) currentPage = 1;
	const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
	currentPage = Math.min(currentPage, totalPages);
	updateUrl(resetPage);
}

function populateYears() {
	if (!yearSelect) return;
	yearSelect.replaceChildren();
	const all = document.createElement("option");
	all.value = "all";
	all.textContent = allYearsText;
	yearSelect.append(all);
	const years = [
		...new Set(
			entries.map((entry) => new Date(entry.published).getUTCFullYear()),
		),
	];
	for (const year of years) {
		const option = document.createElement("option");
		option.value = String(year);
		option.textContent = String(year);
		yearSelect.append(option);
	}
}

function createItem(entry: DynamicData) {
	if (!template) return null;
	const fragment = template.content.cloneNode(true) as DocumentFragment;
	const root = fragment.querySelector<HTMLElement>("[data-dynamic-entry]");
	if (!root) return null;
	const anchorId = `dynamic-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
	const permalinkUrl = new URL(window.location.href);
	permalinkUrl.hash = anchorId;
	const permalink = `${permalinkUrl.pathname}${permalinkUrl.search}${permalinkUrl.hash}`;
	root.id = anchorId;
	root.dataset.year = String(new Date(entry.published).getUTCFullYear());

	const author = root.querySelector<HTMLElement>("[data-dynamic-author]");
	if (author) {
		author.id = `${anchorId}-author`;
		root.querySelector("article")?.setAttribute("aria-labelledby", author.id);
	}
	root
		.querySelectorAll<HTMLAnchorElement>("[data-dynamic-permalink]")
		.forEach((link) => {
			link.href = permalink;
			link.dataset.noSwup = "";
			link.addEventListener("click", (event) => {
				if (
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey
				)
					return;
				event.preventDefault();
				event.stopPropagation();
				history.replaceState(history.state, "", permalink);
			});
		});
	const time = root.querySelector<HTMLTimeElement>("[data-dynamic-time]");
	if (time) {
		const date = new Date(entry.published);
		time.dateTime = date.toISOString();
		// 第三方 API 和 Memos 使用浏览器本地时区，不做额外时区转换
		if (source.startsWith("http") || memos?.enable) {
			time.textContent = date.toLocaleDateString("zh-CN", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
			});
		} else {
			time.textContent = new Intl.DateTimeFormat(
				document.documentElement.lang || undefined,
				{
					timeZone: "UTC",
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				},
			).format(date);
			time.textContent += ` ${formatTimezoneOffset(timezone, date)}`;
		}
	}
	const location = root.querySelector<HTMLElement>("[data-dynamic-location]");
	if (location) {
		const locationText = entry.location?.trim();
		if (locationText) {
			const text = location.querySelector<HTMLElement>(
				"[data-dynamic-location-text]",
			);
			if (text) text.textContent = locationText;
			location.title = locationText;
			location.removeAttribute("hidden");
		} else {
			location.setAttribute("hidden", "");
		}
	}

	const content = root.querySelector<HTMLElement>("[data-dynamic-content]");
	root.querySelector("[data-dynamic-entry-tags]")?.replaceChildren(...(entry.tags ?? []).map((tag) => tagButton(tag)));
	if (content) {
		content.id = `${anchorId}-content`;
		content.innerHTML = entry.html;
		for (const image of entry.images) {
			const element = document.createElement("img");
			element.src = image.src;
			element.alt = image.alt;
			element.loading = "lazy";
			if (image.title) element.title = image.title;
			content.append(element);
		}
		const gallery = root.querySelector<HTMLElement>("dynamic-gallery");
		if (gallery) gallery.dataset.sourceId = content.id;
	}

	// 置顶标识
	const pinned = root.querySelector<HTMLElement>("[data-dynamic-pinned]");
	if (pinned) {
		if (entry.pinned) {
			pinned.removeAttribute("hidden");
		} else {
			pinned.setAttribute("hidden", "");
		}
	}

	const comments = root.querySelector<HTMLElement>("dynamic-inline-comments");
	if (comments) {
		if (showComments) {
			comments.dataset.src = `/dynamic/comments/?path=${encodeURIComponent(
				`/dynamic/${entry.id}/`,
			)}`;
		} else {
			comments.remove();
		}
	}
	return fragment;
}

async function renderItems(items: DynamicData[]) {
	await tick();
	if (!list || !template) return;
	list.replaceChildren();
	for (const entry of items) {
		const item = createItem(entry);
		if (item) list.append(item);
	}
	if (restoreAnchorAfterRender) {
		restoreAnchorAfterRender = false;
		const target = document.getElementById(
			decodeURIComponent(window.location.hash.slice(1)),
		);
		target?.scrollIntoView({ behavior: "auto", block: "start" });
	}
}

function goToPage(page: number) {
	currentPage = page;
	updateUrl(true);
	document
		.querySelector(".page-shell")
		?.scrollIntoView({ behavior: "smooth", block: "start" });
}

$effect(() => {
	if (!templateReady) return;
	renderItems(pageEntries);
});

onMount(() => {
	registerDynamicGallery();
	registerDynamicInlineComments();
	const page = list.closest(".page-shell");
	filterPanel = page?.querySelector<HTMLElement>(".wx-filter") ?? null;
	if (matchMedia("(max-width: 767px)").matches) {
		const calendar = filterPanel?.querySelector<HTMLDetailsElement>(".reference-moment-calendar");
		if (calendar) calendar.open = false;
	}
	template =
		page?.querySelector<HTMLTemplateElement>("[data-dynamic-item-template]") ??
		null;
	templateReady = template !== null;
	searchInput =
		page?.querySelector<HTMLInputElement>("[data-dynamic-search]") ?? null;
	yearSelect =
		page?.querySelector<HTMLSelectElement>("[data-year-select]") ?? null;
	const filter = () => applyFilters();
	const changeYear = () => {
		selectedDay = "";
		if (yearSelect?.value && yearSelect.value !== "all") month = new Date(Number(yearSelect.value), 0, 1);
		refreshCalendar();
		applyFilters();
	};
	const handleFilterClick = (event: Event) => {
		if (!(event.target instanceof Element)) return;
		const button = event.target.closest<HTMLButtonElement>("button");
		if (!button) return;
		const { dynamicDay, dynamicMonthStep, dynamicToday, dynamicTag } = button.dataset;
		if (dynamicTag !== undefined) {
			selectedTag = selectedTag === dynamicTag ? "" : dynamicTag;
			populateTags();
			applyFilters();
		} else if (dynamicDay) {
			selectedDay = selectedDay === dynamicDay ? "" : dynamicDay;
			if (yearSelect) yearSelect.value = "all";
			refreshCalendar();
			if (selectedDay) filterPanel?.querySelector<HTMLButtonElement>(`[data-dynamic-day="${selectedDay}"]`)?.focus();
			applyFilters();
		} else if (dynamicMonthStep) {
			month = new Date(month.getFullYear(), month.getMonth() + Number(dynamicMonthStep), 1);
			refreshCalendar();
		} else if (dynamicToday !== undefined) {
			month = new Date();
			selectedDay = "";
			if (yearSelect) yearSelect.value = "all";
			refreshCalendar();
			applyFilters();
		}
	};
	searchInput?.addEventListener("input", filter);
	yearSelect?.addEventListener("change", changeYear);
	page?.addEventListener("click", handleFilterClick);
	refreshCalendar();

	const load = async () => {
		try {
			if (memos?.enable) {
				entries = await fetchMemos(memos.apiUrl, { parent: memos.parent });
			} else {
				const response = await fetch(source);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				entries = (await response.json()) as DynamicData[];
			}
			// 更新页面计数
			const countEl = document.querySelector("[data-dynamic-page-count]");
			if (countEl) countEl.textContent = String(entries.length);
			populateYears();
			populateTags();
			refreshCalendar();
			currentPage = pageFromUrl();
			applyFilters(false);
			const anchorId = decodeURIComponent(window.location.hash.slice(1));
			if (anchorId) {
				const anchorIndex = filtered.findIndex(
					(entry) =>
						`dynamic-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}` === anchorId,
				);
				if (anchorIndex >= 0) {
					currentPage = Math.floor(anchorIndex / itemsPerPage) + 1;
					updateUrl();
					restoreAnchorAfterRender = true;
				}
			}
		} catch (error) {
			console.error("Failed to load dynamics", error);
			failed = true;
		} finally {
			loading = false;
		}
	};
	void load();

	return () => {
		searchInput?.removeEventListener("input", filter);
		yearSelect?.removeEventListener("change", changeYear);
		page?.removeEventListener("click", handleFilterClick);
	};
});
</script>

{#if loading}
	<div class="page-loading card-base" role="status">
		<span class="page-loading-spinner" aria-hidden="true"></span>
		<p>{loadingText}</p>
	</div>
{:else if failed || entries.length === 0}
	<div class="page-empty card-base">
		<p>{emptyText}</p>
	</div>
{:else if filtered.length === 0}
	<div class="page-no-results card-base">
		<p>{noResultsText}</p>
	</div>
{/if}

<div class="page-feed" bind:this={list}></div>

{#if !loading && !failed}
	<ClientPagination
		totalItems={filtered.length}
		{itemsPerPage}
		{currentPage}
		onPageChange={goToPage}
	/>
{/if}
