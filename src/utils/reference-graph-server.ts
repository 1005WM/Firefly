import { render } from "astro:content";
import { siteConfig } from "@/config";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { getSortedPosts } from "@/utils/content-utils";
import { buildKnowledgeGraphData, type KGData } from "@/utils/knowledge-graph-data";
import { getCategoryUrl, getPostUrlBySlug, getTagUrl } from "@/utils/url-utils";

export async function getKnowledgeGraphData(): Promise<KGData> {
	const posts = (await getSortedPosts()).filter((entry) => !entry.data.draft);
	const input = await Promise.all(posts.map(async (entry) => ({
		id: entry.id,
		title: entry.data.title,
		url: getPostUrlBySlug(entry.id),
		published: entry.data.published,
		category: entry.data.category || null,
		tags: entry.data.tags ?? [],
		headings: entry.data.password ? [] : (await render(entry)).headings,
	})));

	return buildKnowledgeGraphData(input, {
		uncategorizedName: i18n(I18nKey.uncategorized),
		categoryUrl: getCategoryUrl,
		tagUrl: getTagUrl,
		siteStartDate: siteConfig.siteStartDate,
	});
}
