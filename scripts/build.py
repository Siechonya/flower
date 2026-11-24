import glob
import html
import json
import os
import re

SOURCE_DIR = r"C:\Users\predor\Nutstore\1\siecho_1\_大纲\第一卷 降临"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DATA_DIR = os.path.join(REPO_ROOT, "data")
OUT_CHAPTERS_DIR = os.path.join(OUT_DATA_DIR, "chapters")

STAGES = [
    {"id": 1, "name": "第一幕 · 神明降临与守门人觉醒", "range": (1, 15)},
    {"id": 2, "name": "第二幕 · 雪城保卫战", "range": (16, 20)},
    {"id": 3, "name": "第三幕 · 云涡出坞与深空航行", "range": (21, 25)},
    {"id": 4, "name": "第四幕 · 六星追日与迎春归途", "range": (26, 30)},
]


def get_stage(num: int) -> dict:
    for stage in STAGES:
        lo, hi = stage["range"]
        if lo <= num <= hi:
            return stage
    return STAGES[0]


def format_inline(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(r"(?<!\*)\*([^*]+?)\*(?!\*)", r"<em>\1</em>", escaped)
    return escaped


def parse_chapter(filepath: str) -> dict:
    with open(filepath, "r", encoding="utf-8") as fp:
        raw = fp.read()

    lines = raw.splitlines()

    # 1. Strip YAML frontmatter
    if len(lines) >= 3 and lines[0].strip() == "---":
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                lines = lines[i + 1 :]
                break

    # 2. Strip bottom Obsidian navigation block
    while lines and not lines[-1].strip():
        lines.pop()
    # Pop any trailing wikilink/nav lines
    while lines and (
        "[[" in lines[-1]
        or lines[-1].strip().startswith("上一章")
        or lines[-1].strip().startswith("下一章")
        or not lines[-1].strip()
    ):
        lines.pop()
    if lines and lines[-1].strip() == "---":
        lines.pop()
    while lines and not lines[-1].strip():
        lines.pop()

    # 3. Extract chapter title from first H1
    filename = os.path.basename(filepath)
    m_fn = re.match(r"^第(\d+)章\s+(.+)\.md$", filename)
    if not m_fn:
        raise ValueError(f"Unexpected chapter filename: {filename}")
    num = int(m_fn.group(1))
    title = m_fn.group(2).strip()

    body_lines = []
    found_h1 = False
    for line in lines:
        s = line.strip()
        if not found_h1 and s.startswith("# "):
            heading_text = s[2:].strip()
            if heading_text.endswith("%"):
                heading_text = heading_text[:-1].strip()
            m_h1 = re.match(r"^第\d+章\s+(.+)$", heading_text)
            if m_h1:
                title = m_h1.group(1).strip()
            found_h1 = True
            continue
        body_lines.append(line)

    # 4. Render body HTML cleanly
    html_parts = []
    plain_chars = 0

    for line in body_lines:
        s = line.strip()
        if not s:
            continue
        if s == "---":
            html_parts.append('<div class="scene-break" aria-hidden="true"><span>✦</span></div>')
        elif s.startswith("### "):
            scene_text = s[4:].strip()
            if scene_text.endswith("%"):
                scene_text = scene_text[:-1].strip()
            html_parts.append(f'<h2 class="scene-title">{format_inline(scene_text)}</h2>')
        elif s.startswith("## "):
            sub_text = s[3:].strip()
            if sub_text.endswith("%"):
                sub_text = sub_text[:-1].strip()
            html_parts.append(f'<h2 class="scene-title">{format_inline(sub_text)}</h2>')
        elif s.startswith("> "):
            quote_text = s[2:].strip()
            plain_chars += len(quote_text)
            html_parts.append(f"<blockquote><p>{format_inline(quote_text)}</p></blockquote>")
        else:
            plain_chars += len(s)
            html_parts.append(f"<p>{format_inline(s)}</p>")

    stage = get_stage(num)
    return {
        "num": num,
        "label": f"第 {num} 章",
        "title": title,
        "stageId": stage["id"],
        "stageName": stage["name"],
        "chars": plain_chars,
        "html": "\n".join(html_parts),
    }


def main():
    if not os.path.isdir(SOURCE_DIR):
        raise FileNotFoundError(f"Source directory not found: {SOURCE_DIR}")

    os.makedirs(OUT_CHAPTERS_DIR, exist_ok=True)

    files = glob.glob(os.path.join(SOURCE_DIR, "第*章 *.md"))
    chapters = [parse_chapter(f) for f in files]
    chapters.sort(key=lambda c: c["num"])

    if len(chapters) != 30:
        print(f"Warning: expected 30 chapters, found {len(chapters)}")

    toc_chapters = []
    for idx, ch in enumerate(chapters):
        prev_ch = (
            {"num": chapters[idx - 1]["num"], "title": chapters[idx - 1]["title"]}
            if idx > 0
            else None
        )
        next_ch = (
            {"num": chapters[idx + 1]["num"], "title": chapters[idx + 1]["title"]}
            if idx < len(chapters) - 1
            else None
        )

        chapter_payload = {
            "num": ch["num"],
            "label": ch["label"],
            "title": ch["title"],
            "stageId": ch["stageId"],
            "stageName": ch["stageName"],
            "chars": ch["chars"],
            "prev": prev_ch,
            "next": next_ch,
            "html": ch["html"],
        }

        out_file = os.path.join(OUT_CHAPTERS_DIR, f"{ch['num']}.json")
        with open(out_file, "w", encoding="utf-8", newline="\n") as fp:
            json.dump(chapter_payload, fp, ensure_ascii=False, separators=(",", ":"))

        toc_chapters.append(
            {
                "num": ch["num"],
                "label": ch["label"],
                "title": ch["title"],
                "stageId": ch["stageId"],
            }
        )

    toc_payload = {
        "bookTitle": "降临",
        "volumeLabel": "第一卷",
        "epigraph": "主神陨落极北之后，与白发守门人、护主狂狐、老猫狐城主共度的三十个日夜。",
        "totalChapters": len(chapters),
        "stages": [{"id": s["id"], "name": s["name"]} for s in STAGES],
        "chapters": toc_chapters,
    }

    with open(os.path.join(OUT_DATA_DIR, "toc.json"), "w", encoding="utf-8", newline="\n") as fp:
        json.dump(toc_payload, fp, ensure_ascii=False, indent=2)

    print(f"Successfully built {len(chapters)} chapters into {OUT_DATA_DIR}")


if __name__ == "__main__":
    main()
