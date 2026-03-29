#!/bin/bash
# 一键启动新闻抓取+生成日报

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATE="${1:-$(date +%Y-%m-%d)}"

echo "📰 OpenClaw 新闻自动化"
echo "====================="
echo "日期: $DATE"
echo ""

# 1. 抓取RSS新闻
echo "📡 步骤1: 抓取RSS新闻..."
cd "$BASE_DIR/scripts
node rss-news.js "$DATE"

if [ $? -ne 0 ]; then
  echo "❌ RSS抓取失败"
  exit 1
fi

echo ""

# 2. 生成日报
echo "📝 步骤2: 生成早报..."
node daily-news-report.js "$DATE"

if [ $? -ne 0 ]; then
  echo "❌ 日报生成失败"
  exit 1
fi

echo ""
echo "✅ 完成!"
echo ""
echo "📁 新闻数据: $BASE_DIR/news/news-$DATE.json"
echo "📁 日报报告: $BASE_DIR/news/report-$DATE.txt"
