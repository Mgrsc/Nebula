<div align="center">

# ☁️ Nebula

**极简、美观的订阅管理工具**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

Nebula 帮你轻松管理 Netflix、Spotify、域名服务器等各类订阅服务，自动计算周期费用，支持多货币汇率换算与到期自动提醒。

</div>

---

## ✨ 核心功能

- **📊 订阅管理**：支持月/年/自定义周期，自动计算下个扣费日与剩余天数。
- **💱 汇率换算**：支持 160+ 种货币实时汇率，统一折算统计总支出。
- **🔔 到期提醒**：支持 Webhook 推送（飞书、自定义渠道），不错过任何续费。
- **📅 日历视图**：直观的时间线视图，快速查看每月支出分布。
- **💾 数据安全**：支持 WebDAV 自动云备份与恢复，数据掌握在自己手中。
- **🔐 隐私保护**：可设置访问密码，支持只读仪表盘模式。
- **🖼️ 智能 Logo**：自动匹配服务图标，界面美观大方。

---

## 🚀 快速开始

### Docker Compose（推荐）

直接在项目根目录运行：

```bash
docker-compose up -d --build
```

访问 **http://localhost:3000** 即可使用。

### 本地运行

需要安装 [Bun](https://bun.sh)。

```bash
# 1. 启动后端
cd server
bun install
bun start

# 2. 构建前端（另起终端）
cd web
bun install
bun run build
```

---

## ⚙️ 常见配置

- **默认端口**：3000
- **数据存储**：默认存储在 `./data/nebula.db`，Docker 部署时已挂载卷。
- **初始密码**：首次使用无需密码，建议在「设置」页面开启密码保护。

---

## 📄 许可证

本项目基于 [MIT](LICENSE) 协议开源。