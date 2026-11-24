# 降临 · 小说在线阅读站

部署地址：[flower.sicho.cn](https://flower.sicho.cn)（推送 `main` 分支后由 Vercel 自动构建部署）。

## 目录结构

- `index.html` / `styles.css` / `app.js`：纯静态极简文学阅读前端，零外部运行依赖。
- `data/toc.json` & `data/chapters/*.json`：由源文稿生成的章节索引与正文数据。
- `scripts/build.py`：从本地小说正典目录提取并清理 Obsidian 语法后生成静态数据。
- `vercel.json`：Vercel 静态资源缓存策略配置。

## 本地同步与更新发布

```powershell
python scripts/build.py
git add -A
git commit -m "chore: update novel chapters"
git push origin main
```
