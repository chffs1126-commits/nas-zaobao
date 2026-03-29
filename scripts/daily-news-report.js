#!/usr/bin/env node
/**
 * 日报生成+推送脚本
 * 读取 news/news-*.json 生成格式化早报
 * 
 * 使用: node daily-news-report.js [日期]
 */

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const NEWS_DIR = path.join(__dirname, '..', 'news');

const config = require('js-yaml').load(
  fs.readFileSync(path.join(CONFIG_DIR, 'news-config.yaml'), 'utf-8')
);

function log(msg) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${msg}`);
}

function buildReport(date, items) {
  // 分类
  const cats = config.categories;
  const categorized = {
    global_hot: [],
    domestic: [],
    industry: [],
    tech_breakthrough: [],
    risk_regulation: []
  };
  
  for (const item of items) {
    const text = item.title + item.description;
    let placed = false;
    
    for (const [key, cat] of Object.entries(cats)) {
      for (const kw of cat.keywords) {
        if (text.includes(kw)) {
          categorized[key].push(item);
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    
    if (!placed) {
      // 默认归类到行业运用
      categorized.industry.push(item);
    }
  }
  
  // 生成报告
  let report = `📰 AI资讯早报 | ${date}\n\n`;
  
  const catNames = {
    global_hot: '🔥 全球热点',
    domestic: '🇨🇳 国内动态',
    industry: '💼 行业运用',
    tech_breakthrough: '🔬 技术突破',
    risk_regulation: '⚠️ AI风险与监管'
  };
  
  let num = 1;
  for (const [key, catItems] of Object.entries(categorized)) {
    if (catItems.length === 0) continue;
    
    report += `=== ${catNames[key]} ===\n\n`;
    
    for (const item of catItems.slice(0, config.news.maxPerCategory)) {
      const time = new Date(item.pubDate).toISOString().slice(11, 16);
      report += `${num}. ${item.title}\n`;
      report += `   ${item.description.slice(0, 100)}...\n`;
      report += `   链接：${item.link}\n\n`;
      num++;
    }
  }
  
  return { report, categorized };
}

async function pushToFeishu(docId, content) {
  const FeishuDocsAPI = require('/home/fs/.agents/skills/feishu-docs/src/api');
  const api = new FeishuDocsAPI(
    process.env.FEISHU_APP_ID,
    process.env.FEISHU_APP_SECRET
  );
  
  const allBlocks = await api.getAllDocumentBlocks(docId);
  const pageBlock = allBlocks.items.find(b => b.block_type === 1);
  
  const lines = content.split('\n');
  const blocks = lines.map(line => ({
    block_type: 2,
    text: { elements: [{ text_run: { content: line } }] }
  }));
  
  let index = 0;
  const BATCH_SIZE = 50;
  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE);
    await api.createDocumentBlocks(docId, pageBlock.block_id, batch, index);
    index += batch.length;
  }
  
  log(`✅ 已推送至飞书文档`);
}

async function main() {
  const date = process.argv[2] || new Date().toISOString().split('T')[0];
  log(`=== 生成日报 (${date}) ===`);
  
  // 读取新闻数据
  const newsFile = path.join(NEWS_DIR, `news-${date}.json`);
  if (!fs.existsSync(newsFile)) {
    log(`❌ 新闻文件不存在: ${newsFile}`);
    log(`请先运行: node scripts/rss-news.js ${date}`);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(newsFile, 'utf-8'));
  log(`读取 ${data.items.length} 条新闻`);
  
  // 生成报告
  const { report, categorized } = buildReport(date, data.items);
  
  // 统计
  let total = 0;
  for (const items of Object.values(categorized)) {
    total += items.length;
  }
  log(`分类完成: ${total} 条`);
  
  // 保存报告
  const reportFile = path.join(NEWS_DIR, `report-${date}.txt`);
  fs.writeFileSync(reportFile, report);
  log(`💾 报告已保存: ${reportFile}`);
  
  // 推送到飞书
  if (config.feishu.enabled) {
    try {
      // 创建新文档
      const FeishuDocsAPI = require('/home/fs/.agents/skills/feishu-docs/src/api');
      const api = new FeishuDocsAPI(
        process.env.FEISHU_APP_ID,
        process.env.FEISHU_APP_SECRET
      );
      const result = await api.createDocument('', `📰 AI资讯早报 | ${date}`);
      const docId = result.document.document_id;
      log(`📄 创建文档: ${docId}`);
      
      await pushToFeishu(docId, report);
    } catch (err) {
      log(`❌ 推送失败: ${err.message}`);
    }
  }
  
  console.log('\n' + report);
}

main().catch(err => {
  log(`❌ 错误: ${err.message}`);
  process.exit(1);
});
