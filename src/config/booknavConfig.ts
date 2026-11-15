import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "工具库",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// favicon 自动获取配置
	favicon: {
		// 书签未填写 icon 时，是否自动获取目标站点的 favicon 图标
		enabled: true,

		// favicon 接口地址，{domain} 为占位符，会被替换成目标站点域名
		// 更换接口只需保证地址里含有 {domain}，例如：
		//   https://a.favicon.im/{domain}
		//   https://favicon.im/{domain}
		api: "https://a.favicon.im/{domain}",
	},
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		id: "dev",
		name: "开发",
		icon: "material-symbols:code-rounded",
		desc: "写代码时离不开的站点",
		weight: 100,
		items: [
			{
				title: "GitHub",
				url: "https://github.com",
				desc: "全球最大的代码托管平台",
				// icon 字段可以使用 astro-icon 图标库的图标名称
				// 也可以使用图片 URL 和本地图片路径
				// 不填则会通过接口自动获取目标站点的 favicon 图标（需要在上面配置）
				icon: "fa7-brands:github",
				weight: 10,
			},
			{
				title: "MDN Web Docs",
				url: "https://developer.mozilla.org",
				desc: "最权威的 Web 技术文档",
				weight: 9,
			},
			{
				title: "Astro",
				url: "https://astro.build",
				desc: "内容驱动型网站的 Web 框架",
				weight: 8,
			},
			{
				title: "Svelte",
				url: "https://svelte.dev",
				desc: "把组件编译成高效原生 JS 的框架",
				weight: 7,
			},
			{
				title: "Tailwind CSS",
				url: "https://tailwindcss.com",
				desc: "一个功能强大且灵活的 CSS 框架",
				weight: 6,
			},
		],
	},
	{
		id: "opensource",
		name: "项目",
		icon: "material-symbols:code-rounded",
		desc: "好用的开源项目",
		weight: 90,
		items: [
			{
				title: "Firefly",
				url: "https://github.com/CuteLeaf/Firefly",
				desc: "清晰美观的 Astro 个人博客主题模板",
				icon: "/favicon/firefly-32.png",
				weight: 10,
			},
		],
	},
	{
		id: "tools",
		name: "工具",
		icon: "material-symbols:build-outline-rounded",
		desc: "顺手的在线小工具",
		weight: 80,
		items: [
			{
				title: "TinyPNG",
				url: "https://tinypng.com",
				desc: "在线压缩 PNG / JPEG 图片",
				weight: 10,
			},
			{
				title: "Squoosh",
				url: "https://squoosh.app",
				desc: "Google 出品的图片压缩与格式转换",
				weight: 9,
			},
			{
				title: "Carbon",
				url: "https://carbon.now.sh",
				desc: "把代码片段生成漂亮的图片",
				weight: 8,
			},
		],
	},
	{
		id: "resources",
		name: "资源",
		icon: "material-symbols:auto-stories-outline-rounded",
		desc: "文档、教程与阅读",
		weight: 70,
		items: [
			{
				title: "Firefly Docs",
				url: "https://docs-firefly.cuteleaf.cn",
				desc: "Firefly 主题模板文档",
				icon: "https://docs-firefly.cuteleaf.cn/logo.png",
				weight: 10,
			},
			{
				title: "夏夜流萤",
				url: "https://blog.cuteleaf.cn",
				desc: "飞萤之火自无梦的长夜亮起",
				weight: 9,
			},
		],
	},
	{
		id: "relay",
		name: "中转站",
		icon: "material-symbols:swap-horiz-rounded",
		desc: "AI API 中转与模型聚合网关",
		weight: 60,
		items: [
			// 添加网址的方法：复制下面任意一段，改掉 title / url / desc 即可。
			// 注意：items 至少要保留 1 条，空分组会被过滤掉，标签就不会显示了。
			// 模板：
			// {
			// 	title: "站点名称",
			// 	url: "https://example.com",
			// 	desc: "一句话说明",
			// 	weight: 10,     // 可选，数字越大越靠前
			// 	icon: "",       // 可选，留空自动获取站点 favicon
			// 	enabled: true,  // 可选，改成 false 可临时隐藏
			// },
			{
				title: "Diege AI",
				url: "https://diegeai.com/register?aff=mjpx",
				desc: "AI 模型聚合与分发网关，兼容 OpenAI / Claude / Gemini 接口",
				weight: 10,
			},
			{
				title: "Puaai",
				url: "https://puaai.xyz/dashboard",
				desc: "AI API Gateway 控制台",
				weight: 9,
			},
			{
				title: "QE (newssid)",
				url: "https://qe.newssid.com/#/login",
				desc: "AI API 中转服务 · 登录入口",
				weight: 8,
			},
			{
				title: "Wegoo's API",
				url: "https://ai.wegoo.site/",
				desc: "Codex / Claude Code 按量付费 API 中转",
				weight: 7,
			},
			{
				title: "HeyRoute",
				url: "https://heyroute.ai/console",
				desc: "AI 模型 API 接入控制台",
				weight: 6,
			},
		],
	},
	{
		id: "ai-agent",
		name: "AI智能体",
		icon: "material-symbols:smart-toy-outline-rounded",
		desc: "常用 AI 对话助手与智能创作工具",
		weight: 55,
		items: [
			// 添加网址的格式见上方「中转站」分组里的模板注释
			{
				title: "DeepSeek",
				url: "https://www.deepseek.com",
				desc: "深度求索大模型对话助手",
				weight: 10,
			},
			{
				title: "豆包",
				url: "https://www.doubao.com",
				desc: "字节跳动旗下 AI 智能助手",
				weight: 9,
			},
			{
				title: "Kimi",
				url: "https://www.kimi.com",
				desc: "月之暗面 AI 助手，长文本与智能体任务",
				weight: 8,
			},
			{
				title: "ChatGPT",
				url: "https://chatgpt.com",
				desc: "OpenAI 的 AI 对话助手",
				weight: 7,
			},
			{
				title: "Claude",
				url: "https://claude.ai",
				desc: "Anthropic 的 AI 助手",
				weight: 6,
			},
			{
				title: "Gemini",
				url: "https://gemini.google.com",
				desc: "Google 的 AI 助手",
				weight: 5,
			},
			{
				title: "即梦 AI",
				url: "https://jimeng.jianying.com",
				desc: "一站式 AI 绘画与 AIGC 视频创作平台",
				weight: 4,
			},
		],
	},
];
