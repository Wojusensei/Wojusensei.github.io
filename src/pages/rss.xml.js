import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

// RSS 订阅源：/rss.xml，收录全部博客文章
export async function GET(context) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  return rss({
    title: 'Wojusensei 的博客',
    description: '技术笔记、开发日志与随想',
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `/blog/${p.id}/`,
    })),
    customData: '<language>zh-cn</language>',
  });
}
