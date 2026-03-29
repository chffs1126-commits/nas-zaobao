#!/bin/bash
# 一键安装依赖

echo "📦 安装Node.js依赖..."

cd "$(dirname "$0")/.."

# 初始化npm（如果需要）
if [ ! -f package.json ]; then
  npm init -y
fi

# 安装依赖
npm install rss-parser js-yaml exceljs

echo "✅ 依赖安装完成!"
echo ""
echo "下一步: 运行 ./start.sh 开始抓取新闻"
