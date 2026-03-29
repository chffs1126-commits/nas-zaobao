# OpenClaw 新闻自动化模板

AI资讯早报自动化抓取+生成系统

## 目录结构

```
openclaw-news-template/
├── config/                    # 配置中心
│   ├── rss-feeds.json       # RSS源配置
│   ├── news-config.yaml      # 新闻处理规则
│   └── llm-config.json      # LLM配置（预留）
├── scripts/
│   ├── rss-news.js          # 基础RSS聚合
│   └── daily-news-report.js # 日报生成+推送
├── news/                     # 生成新闻存放
├── logs/                     # 运行日志
├── install.sh               # 一键安装
├── start.sh                 # 一键启动
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd openclaw-news-template
bash install.sh
```

### 2. 配置RSS源

编辑 `config/rss-feeds.json`，启用需要的源

### 3. 运行

```bash
# 抓取今天新闻
bash start.sh

# 抓取指定日期
bash start.sh 2026-03-29
```

## 配置说明

### RSS源配置 (config/rss-feeds.json)

```json
{
  "name": "IT之家",
  "url": "https://www.ithome.com/rss/",
  "enabled": true,
  "category": "tech"
}
```

### 新闻配置 (config/news-config.yaml)

- `targetDate`: 抓取日期 (today/yesterday/指定日期)
- `categories`: 新闻分类规则
- `feishu`: 飞书推送配置

## RSS源推荐

| 网站 | RSS地址 | 状态 |
|------|---------|------|
| IT之家 | https://www.ithome.com/rss/ | ✅ 可用 |
| 爱范儿 | https://www.ifanr.com/feed | ✅ 可用 |
| 36氪 | https://36kr.com/feed | ⚠️ 有验证 |

## 自动化定时任务

配合cron实现每日自动抓取：

```bash
# 每天9点自动运行
0 9 * * * cd /home/fs/.openclaw/workspace/openclaw-news-template && bash start.sh >> logs/cron.log 2>&1
```

## 依赖

- Node.js >= 16
- npm
- rss-parser
- js-yaml
- exceljs (用于Excel报表)
