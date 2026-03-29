#!/usr/bin/env node
/**
 * 基础RSS新闻聚合脚本
 * 读取 config/rss-feeds.json 获取RSS源列表
 * 
 * 使用: node rss-news.js [日期]
 */

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const NEWS_DIR = path.join(__dirname, '..', 'news');
const LOG_DIR = path.join(__dirname, '..', 'logs');

// 加载配置
const feedsConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'rss-feeds.json'), 'utf-8'));

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenClaw-News/1.0)' }
});

function log(msg) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${msg}`);
  fs.appendFileSync(path.join(LOG_DIR, 'rss-news.log'), `[${now}] ${msg}\n`);
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
}

function truncate(text, maxLen = 200) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

function isAIRelated(item) {
  const text = (item.title + ' ' + (item.description || '')).toLowerCase();
  
  // 排除词
  for (const kw of feedsConfig.filter.excludeKeywords) {
    if (item.title.toLowerCase().includes(kw.toLowerCase())) return false;
  }
  
  // AI关键词匹配
  let matchCount = 0;
  for (const kw of feedsConfig.filter.aiKeywords) {
    if (text.includes(kw.toLowerCase())) matchCount++;
  }
  return matchCount >= feedsConfig.filter.minMatchCount;
}

async function fetchFeed(feed) {
  if (!feed.enabled) {
    log(`${feed.name}: 已禁用`);
    return [];
  }
  
  try {
    log(`📡 获取 ${feed.name}...`);
    const parsed = await parser.parseURL(feed.url);
    const items = parsed.items.slice(0, feed.maxItemsPerFeed || 40).map(item => ({
      title: stripHtml(item.title || ''),
      description: truncate(stripHtml(item.contentSnippet || item.content || '')),
      link: item.link || item.guid || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source: feed.name,
      category: feed.category
    }));
    
    const aiItems = items.filter(item => isAIRelated(item));
    log(`  ✅ ${feed.name}: ${items.length}条 (AI相关: ${aiItems.length})`);
    return aiItems;
  } catch (err) {
    log(`  ❌ ${feed.name} 失败: ${err.message}`);
    return [];
  }
}

async function main() {
  const targetDate = process.argv[2] || new Date().toISOString().split('T')[0];
  log(`\n=== 开始抓取新闻 (${targetDate}) ===`);
  
  // 确保目录存在
  [NEWS_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  
  // 启用且有URL的源
  const enabledFeeds = feedsConfig.feeds.filter(f => f.enabled && f.url);
  
  // 并行抓取
  const results = await Promise.all(enabledFeeds.map(f => fetchFeed(f)));
  let allItems = results.flat();
  
  // 日期过滤
  if (targetDate !== 'all') {
    allItems = allItems.filter(item => {
      const itemDate = new Date(item.pubDate).toISOString().split('T')[0];
      return itemDate === targetDate;
    });
  }
  
  // 按时间排序
  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  // 统计
  const total = allItems.length;
  const bySource = {};
  allItems.forEach(item => {
    if (!bySource[item.source]) bySource[item.source] = 0;
    bySource[item.source]++;
  });
  
  log(`\n=== 统计 ===`);
  log(`AI相关新闻: ${total}条`);
  for (const [src, count] of Object.entries(bySource)) {
    log(`  ${src}: ${count}条`);
  }
  
  // 保存结果
  const outputFile = path.join(NEWS_DIR, `news-${targetDate}.json`);
  fs.writeFileSync(outputFile, JSON.stringify({
    date: targetDate,
    total,
    sources: Object.keys(bySource),
    items: allItems
  }, null, 2));
  log(`\n💾 已保存: ${outputFile}`);
  
  return { date: targetDate, total, items: allItems };
}

main().catch(err => {
  log(`❌ 错误: ${err.message}`);
  process.exit(1);
});
