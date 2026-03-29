#!/usr/bin/env node
/**
 * 日报生成+AI处理脚本
 * 读取 news/news-*.json 生成格式化早报
 * 使用AI进行摘要、去重、分类
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

// 简单的去重函数（基于标题相似度）
function deduplicate(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '').slice(0, 30);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

// 简单的文本摘要函数
function summarize(item, maxLen = 100) {
  const text = item.description || item.title;
  // 去除HTML标签和多余空白
  const clean = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 3) + '...';
}

// 分类函数
function classify(item) {
  const text = (item.title + ' ' + item.description).toLowerCase();
  
  const rules = [
    { cat: 'AI风险与监管', keywords: ['监管', '安全', '伦理', '风险', '裁员', '失控', '威胁', '隐私', '温度', '过热'] },
    { cat: '全球热点', keywords: ['美国', '谷歌', 'openai', 'anthropic', 'meta', 'tesla', '英国', '欧盟', '俄罗斯'] },
    { cat: '国内动态', keywords: ['中国', '华为', '百度', '腾讯', '阿里', '字节', '小米', '比亚迪', '蔚来', '小鹏', '宇树', 'TCL', '蚂蚁', '吉利', '量子', '蔚来'] },
    { cat: '技术突破', keywords: ['突破', '研究', '科学家', '实验', '论文', '学术', '量子', '碳纳米管', '6G', '首次'] },
    { cat: '行业运用', keywords: ['自动驾驶', '智能驾驶', '人形机器人', '具身', 'AI短剧', 'AI短剧', '智能制造', 'FSD'] }
  ];
  
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.cat;
    }
  }
  return '产业';
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function buildReport(date, items) {
  // 去重
  const unique = deduplicate(items);
  
  // 分类
  const categorized = {};
  for (const item of unique) {
    const cat = classify(item);
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push({
      ...item,
      summary: summarize(item, 120),
      category: cat
    });
  }
  
  // 构建报告
  const catNames = {
    '全球热点': '🔥 全球热点',
    '国内动态': '🇨🇳 国内动态',
    '行业运用': '💼 行业运用',
    '技术突破': '🔬 技术突破',
    'AI风险与监管': '⚠️ AI风险与监管',
    '产业': '📊 产业'
  };
  
  const catOrder = ['全球热点', '国内动态', '行业运用', '技术突破', 'AI风险与监管', '产业'];
  
  let report = `# 📰 AI资讯早报 | ${date}\n\n`;
  report += `> 本报告由 OpenClaw AI 自动抓取、去重、分类生成\n\n`;
  report += `---\n\n`;
  
  let total = 0;
  for (const cat of catOrder) {
    const catItems = categorized[cat];
    if (!catItems || catItems.length === 0) continue;
    
    total += catItems.length;
    report += `## ${catNames[cat]}\n\n`;
    
    catItems.forEach((item, i) => {
      const num = catItems.length > 1 ? `${i + 1}. ` : '';
      report += `### ${num}${item.title}\n\n`;
      report += `**来源**: ${item.source} | **时间**: ${formatTime(item.pubDate)}\n\n`;
      report += `**摘要**: ${item.summary}\n\n`;
      report += `🔗 ${item.link}\n\n`;
    });
  }
  
  // 统计
  report += `---\n\n`;
  report += `## 📊 统计信息\n\n`;
  report += `- **新闻总数**: ${items.length}条 → 去重后${total}条\n`;
  report += `- **来源分布**: ${[...new Set(items.map(i => i.source))].join(' / ')}\n`;
  report += `- **抓取时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  report += `- **处理**: OpenClaw AI 自动摘要·分类\n\n`;
  report += `---\n\n`;
  report += `*本报告由 OpenClaw 新闻自动化系统生成*\n`;
  
  return { report, total, categorized };
}

async function main() {
  const date = process.argv[2] || new Date().toISOString().split('T')[0];
  console.log(`=== 生成日报 (${date}) ===`);
  
  // 读取新闻数据
  const newsFile = path.join(NEWS_DIR, `news-${date}.json`);
  if (!fs.existsSync(newsFile)) {
    console.log(`❌ 新闻文件不存在: ${newsFile}`);
    console.log(`请先运行: node scripts/rss-news.js ${date}`);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(newsFile, 'utf-8'));
  console.log(`读取 ${data.items.length} 条新闻`);
  
  // 生成报告
  const { report, total, categorized } = buildReport(date, data.items);
  
  // 统计
  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length > 0) {
      console.log(`  ${cat}: ${items.length}条`);
    }
  }
  
  // 保存报告
  const reportFile = path.join(NEWS_DIR, `report-${date}-ai.md`);
  fs.writeFileSync(reportFile, report);
  console.log(`\n💾 报告已保存: ${reportFile}`);
  
  // 同时生成纯文本版本（兼容飞书）
  const txtReport = report.replace(/[#*>`]/g, '').replace(/\n\n+/g, '\n');
  const txtFile = path.join(NEWS_DIR, `report-${date}.txt`);
  fs.writeFileSync(txtFile, txtReport);
  console.log(`💾 文本报告: ${txtFile}`);
  
  // 输出到控制台
  console.log('\n' + report);
}

main().catch(err => {
  console.error(`❌ 错误: ${err.message}`);
  process.exit(1);
});
