import { expressiveCodeConfig, navbarMode, siteConfig } from "@/config";
import type { WALLPAPER_MODE } from "@/types/config";
import { scheduleContentOverflowEnhancements } from "@/utils/content-overflow-utils";
import { initializeFloatingPanels } from "@/utils/floating-panel-utils";
import {
	syncFullscreenBlur,
	syncFullscreenOverlays,
	updateFullscreenTitleParallax,
} from "@/utils/fullscreen-wallpaper-utils";
import {
	updateMainGridCols,
	updateSidebarComponentsVisibility,
} from "@/utils/grid-layout-utils";
import { scrollFunction } from "@/utils/scroll-utils";
import {
	syncBannerHomeTextVisibility,
	updateNavbarTransparency,
} from "@/utils/setting-utils";
import { pathsEqual, url } from "@/utils/url-utils";

/**
 * 进度条：WAAPI 驱动 transform/opacity（合成线程动画）。
 * 替代原 width 关键帧 + `void offsetWidth` 强制回流方案——后者在大型文章 DOM 上
 * 会触发整棵布局树同步重排，正是切页卡顿来源之一。
 */
function startProgressBar(): void {
	const bar = document.getElementById("progress-bar");
	if (!bar) return;
	bar.getAnimations().forEach((a) => {
		a.cancel();
	});
	bar.animate(
		[
			{ transform: "scaleX(0)", opacity: 1 },
			{ transform: "scaleX(0.95)", opacity: 1 },
		],
		{
			duration: 8000,
			easing: "cubic-bezier(0.1, 0.05, 0.1, 1)",
			fill: "forwards",
		},
	);
}

function finishProgressBar(): void {
	const bar = document.getElementById("progress-bar");
	if (!bar) return;
	bar.getAnimations().forEach((a) => {
		a.cancel();
	});
	bar.animate(
		[
			{ transform: "scaleX(1)", opacity: 1 },
			{ transform: "scaleX(1)", opacity: 0 },
		],
		{ duration: 500, easing: "ease-out", fill: "forwards" },
	);
}

/**
 * Swup 页面切换编排（从 Layout.astro 迁出）。
 * 注册 link:click / content:replace / visit:start / page:view / visit:end 钩子。
 */
function registerSwupHooks(): void {
	// 非首页全屏模式与 overlay 一致（内容在最上面），首页 hero 结构回顶即可，
	// 均无需自定义 swup 回顶行为，保留默认滚动到顶部
	// TODO: temp solution to change the height of the banner
	window.swup.hooks.on(
		"link:click",
		(_visit: unknown, { el }: { el: HTMLAnchorElement }) => {
			// Remove the delay for the first time page load
			document.documentElement.style.setProperty("--content-delay", "0ms");

			// 同页链接点击不需要过渡保护
			const targetHref = el.getAttribute("href") || "";
			const targetPathname = (() => {
				try {
					return new URL(targetHref, window.location.href).pathname;
				} catch {
					return targetHref;
				}
			})();
			const isSamePage = pathsEqual(targetPathname, window.location.pathname);
			if (isSamePage) {
				document.documentElement.classList.remove("is-page-transitioning");
			}
			if (!isSamePage) {
				// 添加页面切换保护，防止导航栏闪烁
				document.documentElement.classList.add("is-page-transitioning");
			}

			const navbar = document.getElementById("navbar-wrapper");
			if (navbar && navbarMode === "dynamic") {
				// 切页时先显示导航栏，避免新页从隐藏态开始；滚动逻辑会随滚动位置重新判断
				navbar.classList.remove("navbar-hidden");
				document.body.classList.remove("dynamic-navbar-hidden");
			} else if (navbar) {
				// fixed / static：切页时先显示导航栏，避免残留上一页（如滚到底部时隐藏）的 navbar-hidden，
				// 否则从其它页面切回首页时导航栏会保持隐藏、不再跨壁纸显示
				navbar.classList.remove("navbar-hidden");
			}
		},
	);
	window.swup.hooks.on("content:replace", () => {
		// Switch page-level styles only after the outgoing content has been replaced.
		const isHomePage = pathsEqual(window.location.pathname, url("/"));
		document.body.classList.toggle("is-home", isHomePage);
		document.getElementById("navbar")?.setAttribute("data-is-home", String(isHomePage));
		updateMainGridCols();
		updateSidebarComponentsVisibility();
		initializeFloatingPanels();

		// 只处理katex元素的容器，使用浏览器原生滚动条
		scheduleContentOverflowEnhancements();

		// 重新初始化图标加载器
		import("@/utils/icon-loader").then(({ initIconLoader }) => {
			initIconLoader();
		});

		// 重新初始化semifull模式的滚动检测
		// （全屏模式跳过：导航栏状态由 updateNavbarTransparency 统一管理，
		//   避免切换页面时 initSemifullScrollDetection 重置 scrolled 导致背景闪烁）
		const navbar = document.getElementById("navbar");
		if (navbar) {
			const transparentMode = navbar.getAttribute("data-transparent-mode");
			const navWallpaperMode = document.documentElement.getAttribute(
				"data-wallpaper-mode",
			);

			if (transparentMode === "semifull" && navWallpaperMode !== "fullscreen") {
				// 重新调用初始化函数来重新绑定滚动事件
				if (typeof window.initSemifullScrollDetection === "function") {
					window.initSemifullScrollDetection();
				}
			}
		}
	});
	window.swup.hooks.on("visit:start", () => {
		startProgressBar();
	});
	window.swup.hooks.on("page:view", () => {
		// 过渡结束后再量一次，避免顶部组件未就绪时读到 offsetHeight=0 而误删 mb-4
		// (sticky 与 top 组件之间间距只在 refreshSidebarStickyState 里恢复，延迟补偿一次更稳)
		window.setTimeout(() => updateSidebarComponentsVisibility(), 300);

		// 页面切换完成后，同步全屏模式的标题视差位移（Swup 已替换容器内容）
		updateFullscreenTitleParallax();
		syncFullscreenOverlays();
		syncFullscreenBlur();
		// 页面切换后同步首页标题显隐（body.is-home 已更新，按新页面重算 hidden 类）
		syncBannerHomeTextVisibility();
		// 页面切换后按新页面刷新导航栏透明状态（全屏首页动态透明 / 非首页完全透明）
		updateNavbarTransparency(
			document.documentElement.getAttribute(
				"data-wallpaper-mode",
			) as WALLPAPER_MODE,
		);

		// 在移动端恢复文章列表容器的过渡动画（在主内容区位置动画完成后）
		const isMobile = window.innerWidth < 1024;
		if (isMobile) {
			setTimeout(() => {
				const postListContainer = document.getElementById(
					"post-list-container",
				);
				if (postListContainer) {
					postListContainer.style.transition = "";
				}
			}, 600); // 等待主内容区动画完成（0.4s + 0.1s delay + 100ms buffer）
		}

		// 同步主题状态 - 解决从首页进入文章页面时代码块渲染问题
		const storedTheme =
			localStorage.getItem("theme") ||
			siteConfig.themeColor.defaultMode ||
			"light";
		let isDark = false;

		// 处理 system 模式
		if (storedTheme === "system") {
			isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
		} else {
			isDark = storedTheme === "dark";
		}

		const expectedTheme = isDark
			? expressiveCodeConfig.darkTheme
			: expressiveCodeConfig.lightTheme;
		const currentTheme = document.documentElement.getAttribute("data-theme");

		// 如果主题不匹配，静默更新（不触发事件，避免重新加载效果）
		if (currentTheme !== expectedTheme) {
			document.documentElement.setAttribute("data-theme", expectedTheme);
		}

		// 检查当前页面是否为文章页面，如果是则触发自定义事件用于初始化评论系统
		setTimeout(() => {
			if (document.getElementById("tcomment")) {
				// 触发自定义事件，通知评论系统页面已完全加载
				const pageLoadedEvent = new CustomEvent("firefly:page:loaded", {
					detail: {
						path: window.location.pathname,
						timestamp: Date.now(),
					},
				});
				document.dispatchEvent(pageLoadedEvent);
				console.log(
					"Layout: 触发 firefly:page:loaded 事件，路径:",
					window.location.pathname,
				);
			}
		}, 300);
	});
	window.swup.hooks.on("visit:end", (_visit: { to: { url: string } }) => {
		// Finish progress bar（WAAPI：快速填满后淡出）
		finishProgressBar();

		setTimeout(() => {
			// Just make the transition looks better
			// 移除页面切换保护，恢复过渡动画
			document.documentElement.classList.remove("is-page-transitioning");
			scrollFunction();
		}, 200);
	});
}

/** 注册 Swup 钩子（swup 就绪时立即执行，否则等待 swup:enable 事件） */
export function setupSwupTransitions(): void {
	if (window?.swup?.hooks) {
		registerSwupHooks();
	} else {
		document.addEventListener("swup:enable", registerSwupHooks);
	}
}
