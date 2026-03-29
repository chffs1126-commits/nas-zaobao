#!/usr/bin/env node
/**
 * 全源深度抓取脚本
 * 结合RSS + 搜索获取更全面的新闻覆盖
 * 
 * 使用: node full-news-pipeline.js [日期]
 */

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const NEWS_DIR = path.join(__dirname, '..', 'news');
const LOG_DIR = path.join(__dirname, '..', 'logs');

const feedsConfig = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'rss-feeds.json'), 'utf-8'));
const newsConfig = require('js-yaml').load(fs.readFileSync(path.join(CONFIG_DIR, 'news-config.yaml'), 'utf-8'));

const parser = new Parser({ timeout: 15000 });

function log(msg) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${msg}`);
  fs.appendFileSync(path.join(LOG_DIR, 'full-pipeline.log'), `[${now}] ${msg}\n`);
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function isAIRelated(title, desc) {
  const text = (title + ' ' + desc).toLowerCase();
  for (const kw of feedsConfig.filter.excludeKeywords) {
    if (title.toLowerCase().includes(kw.toLowerCase())) return false;
  }
  let count = 0;
  for (const kw of feedsConfig.filter.aiKeywords) {
    if (text.includes(kw.toLowerCase())) count++;
  }
  return count >= feedsConfig.filter.minMatchCount;
}

async function fetchAllRSS() {
  log('📡 开始RSS抓取...');
  const enabledFeeds = feedsConfig.feeds.filter(f => f.enabled && f.url);
  const results = await Promise.all(enabledFeeds.map(async feed => {
    try {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.slice(0, 50).map(item => ({
        title: stripHtml(item.title || ''),
        description: stripHtml(item.contentSnippet || item.content || '').slice(0, 200),
        link: item.link || item.guid || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        source: feed.name
      }));
    } catch (err) {
      log(`  ❌ ${feed.name}: ${err.message}`);
      return [];
    }
  }));
  return results.flat();
}

async function fetchViaSearch(date) {
  log('🔍 尝试搜索增强...');
  // 这里可以集成搜索引擎API获取更多新闻
  // 目前预留接口，暂未实现
  return [];
}

function classify(text) {
  const cats = newsConfig.categories;
  const catNames = {
    global_hot: '全球热点',
    domestic: '国内动态',
    industry: '行业运用',
    tech_breakthrough: '技术突破',
    risk_regulation: 'AI风险与监管'
  };
  
  for (const [key, cat] of Object.entries(cats)) {
    for (const kw of cat.keywords) {
      if (text.includes(kw)) return catNames[key];
    }
  }
  return '行业运用';
}

async function main() {
  const targetDate = process.argv[2] || new Date().toISOString().split('T')[0];
  log(`\n=== 全源深度抓取开始 (${targetDate}) ===`);
  
  [NEWS_DIR, LOG_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
  
  // 1. RSS抓取
  let items = await fetchAllRSS();
  
  // 2. 搜索增强
  const searchItems = await fetchViaSearch(targetDate);
  items = [...items, ...searchItems];
  
  // 3. 日期过滤
  items = items.filter(item => {
    const itemDate = new Date(item.pubDate).toISOString().split('T')[0];
    return itemDate === targetDate;
  });
  
  // 4. AI过滤
  let aiItems = items.filter(item => isAIRelated(item.title, item.description));
  
  // 5. 分类
  aiItems.forEach(item => {
    item.category = classify(item.title + item.description);
  });
  
  // 6. 按时间排序
  aiItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  log(`\n📊 统计:`);
  log(`  总新闻: ${items.length}`);
  log(`  AI相关: ${aiItems.length}`);
  
  // 7. 保存
  const output = {
    date: targetDate,
    total: aiItems.length,
    byCategory: {},
    items: aiItems
  };
  
  aiItems.forEach(item => {
    if (!output.byCategory[item.category]) output.byCategory[item.category] = 0;
    output.byCategory[item.category]++;
  });
  
  for (const [cat, count] of Object.entries(output.byCategory)) {
    log(`  ${cat}: ${count}条`);
  }
  
  const outputFile = path.join(NEWS_DIR, `full-news-${targetDate}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  log(`\n💾 已保存: ${outputFile}`);
  
  return output;
}

main().catch(err => {
  log(`❌ 错误: ${err.message}`);
  process.exit(1);
});
