// 博客公共小工具
// 阅读时长估算：中英混合按去空白后 400 字符/分钟，至少 1 分钟
export function readingMinutes(body: string | undefined): number {
  if (!body) return 1;
  return Math.max(1, Math.round(body.replace(/\s/g, '').length / 400));
}
