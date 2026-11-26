# 生成《橡遇 · 人机协作记录》PPT
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

INK = RGBColor(0x1A, 0x1A, 0x1F)
MUTED = RGBColor(0x6B, 0x6B, 0x7A)
BRAND = RGBColor(0x5B, 0x55, 0xF0)
LIGHT = RGBColor(0xF4, 0xF2, 0xFF)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LINE = RGBColor(0xE6, 0xE3, 0xF5)

FONT = "Microsoft YaHei"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def set_font(run, size, bold=False, color=INK):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = FONT
    rPr = run._r.get_or_add_rPr()
    for tag in ("a:ea", "a:cs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = rPr.makeelement(qn(tag), {})
            rPr.append(el)
        el.set("typeface", FONT)


def textbox(slide, x, y, w, h, text, size=20, bold=False, color=INK, align=PP_ALIGN.LEFT, spacing=1.4):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    lines = text.split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        p.space_after = Pt(6)
        r = p.add_run()
        r.text = line
        set_font(r, size, bold, color)
    return box


def bar(slide, x, y, w=Inches(0.09), h=Inches(0.52), color=BRAND):
    shape = slide.shapes.add_shape(1, Inches(x), Inches(y), w, h)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    return shape


def page(title, kicker="", footer=""):
    s = prs.slides.add_slide(BLANK)
    bar(s, 0.9, 0.72)
    textbox(s, 1.15, 0.56, 11, 0.6, title, 30, True)
    if kicker:
        textbox(s, 1.17, 1.30, 11, 0.4, kicker, 14, False, MUTED)
    if footer:
        textbox(s, 0.9, 6.92, 11.6, 0.3, footer, 11, False, MUTED)
    return s


def bullets(s, items, top=1.95, size=19, gap=0.78, x=0.95, w=11.3):
    y = top
    for item in items:
        head, _, body = item.partition("｜")
        p = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(gap))
        tf = p.text_frame
        tf.word_wrap = True
        tf.margin_left = 0
        para = tf.paragraphs[0]
        para.line_spacing = 1.5
        r1 = para.add_run()
        r1.text = head
        set_font(r1, size, True, INK)
        if body:
            r2 = para.add_run()
            r2.text = "   " + body
            set_font(r2, size - 2, False, MUTED)
        y += gap


# 1 封面
s = prs.slides.add_slide(BLANK)
bg = s.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height)
bg.fill.solid()
bg.fill.fore_color.rgb = LIGHT
bg.line.fill.background()

textbox(s, 1.0, 2.05, 11, 0.5, "青岛科技大学 2026 人工智能应用创新大赛", 15, False, MUTED)
textbox(s, 1.0, 2.6, 11, 1.2, "橡遇 XIANGYU", 54, True)
textbox(s, 1.0, 3.75, 11, 0.8, "一个校园学习互助站，是怎么用 AI 做出来的", 26, False, INK)
textbox(s, 1.0, 4.75, 10.5, 1.0, "人机协作过程记录 · 11 月 4 日 — 11 月 26 日", 16, False, MUTED)
textbox(s, 1.0, 6.55, 10, 0.35, "作者：雨时（通信工程）　类别：AI 原生代码创意编程", 13, False, MUTED)

# 2 结论
s = page("先说三件事", "看完整份材料只需要记住这三条", "1 / 13")
bullets(
    s,
    [
        "做了一个能用的站｜注册、发动态、传资料、找搭子、私信、管理后台，全部跑在真实服务器上",
        "代码大部分是 AI 写的｜界面、逻辑、部署脚本，我基本没手敲",
        "但每个决定是我做的｜功能砍哪些、数据怎么存、什么算做完，AI 不懂，也不该它懂",
    ],
    top=2.15,
    size=21,
    gap=1.0,
)

# 3 怎么用
s = page("我把 AI 当实习生用，不当许愿机", "三类任务分得很清楚，混着用就会翻车", "2 / 13")
bullets(
    s,
    [
        "交给 AI 的｜写页面、写样式、生成测试脚本、查报错信息里的关键词",
        "我自己做的｜砍需求、定数据长什么样、判断它给的方案合不合理",
        "验收办法｜每个功能都跑一遍脚本，看得到结果才算完，不看它说“已完成”",
    ],
    top=2.1,
    size=20,
    gap=0.95,
)

# 4 时间线
s = page("12 天，六个阶段", "不是一次生成，是反复改出来的", "3 / 13")
rows = [
    ("11.04", "定方向", "砍掉三个花哨功能，只留资料、学伴、圈子"),
    ("11.05", "搭骨架", "注册登录、兴趣圈、搭子发布"),
    ("11.06", "补社交", "动态、相册、日志、留言板、私信"),
    ("11.13", "补安全", "管理员、封禁、文件从数据库里搬出去"),
    ("11.13", "上云端", "零依赖 Node 服务 + 实时推送"),
    ("11.23", "换平台", "部署到 Cloudflare，手机电脑互通"),
]
y = 1.9
for d, t, desc in rows:
    textbox(s, 0.95, y, 1.0, 0.4, d, 15, True, BRAND)
    textbox(s, 2.0, y, 1.7, 0.4, t, 16, True)
    textbox(s, 3.9, y, 8.3, 0.4, desc, 15, False, MUTED)
    y += 0.72

# 5 案例一
s = page("案例一：相册越同步越多", "一个我没想明白、AI 也答错一次的问题", "4 / 13")
bullets(
    s,
    [
        "现象｜刷新几次以后，2 个相册变成 28 个，再刷新变成 84 个",
        "AI 第一反应｜说是“重复点击导致的”，让我加防抖——没用",
        "我自己查｜发现是同步逻辑把服务器拉回来的数据又当成新改动推了回去",
        "改法｜加一个“正在应用远端数据”的开关，再给每条记录做去重 id",
        "验证｜写了个脚本连续轮询两次，数量不变才算过",
    ],
    top=1.95,
    size=17,
    gap=0.82,
)

# 6 案例二
s = page("案例二：删掉的东西自己回来", "这次错在我，不在 AI", "5 / 13")
bullets(
    s,
    [
        "现象｜删了相册，刷新后又出现了",
        "原因｜推送逻辑只写了“新建”，没写“删除”，服务器上根本没删",
        "改法｜补一套删除指令，并且服务端按 id 幂等处理",
        "教训｜AI 按我说的“同步”写代码，它不会替我想“删了怎么办”",
    ],
    top=2.0,
    size=19,
    gap=0.95,
)

# 7 案例三
s = page("案例三：三个平台，踩了三种坑", "最后能用的只有一个", "6 / 13")
bullets(
    s,
    [
        "GitHub Pages｜能打开，但没有后端，每个人数据各存各的",
        "Supabase｜数据库建好了，域名被你所在网络 DNS 污染，浏览器直接解析失败",
        "Render / Vercel / Fly｜要么要求绑卡，要么连接超时",
        "Cloudflare｜静态站 + 接口函数 + KV 数据库，免费而且能访问",
        "又踩一个｜密码哈希 12 万次迭代，超过免费版 10 毫秒 CPU 限制，注册直接 500",
    ],
    top=1.9,
    size=17,
    gap=0.85,
)

# 8 提示词
s = page("我实际用过的三句话", "网上那些“提示词模板”我没用，这三句就够了", "7 / 13")
quotes = [
    ("“先别写代码，告诉我这个功能需要存哪些字段。”", "逼它先想数据，避免后面返工"),
    ("“改完告诉我怎么验证，给我一条能跑的命令。”", "让它自己交作业，而不是我说了算"),
    ("“这个报错你先别猜原因，把日志里最可疑的三行找出来。”", "防止它一本正经地胡说"),
]
y = 1.95
for q, why in quotes:
    box = s.shapes.add_shape(1, Inches(0.95), Inches(y), Inches(11.3), Inches(1.25))
    box.fill.solid()
    box.fill.fore_color.rgb = WHITE
    box.line.color.rgb = LINE
    textbox(s, 1.15, y + 0.18, 10.8, 0.5, q, 18, False, INK)
    textbox(s, 1.15, y + 0.72, 10.8, 0.4, why, 13, False, MUTED)
    y += 1.45

# 9 拒绝
s = page("我删掉的 AI 建议", "这些是它主动提的，我没采纳", "8 / 13")
bullets(
    s,
    [
        "“加个 AI 破冰按钮会更有卖点”｜我删了。没接通的按钮，评委一点就穿帮",
        "“首页写‘没有机器人’显得真实”｜我删了。默认就该是真的，写出来反而像解释",
        "“用渐变和动画让页面更活跃”｜留了一点点，剩下的删了，怕像十年前的企业站",
        "判断标准｜用户看到这句话，会更信任还是更怀疑",
    ],
    top=2.0,
    size=19,
    gap=0.95,
)

# 10 分工表
s = page("人和 AI，各自负责什么", "", "9 / 13")
table = s.shapes.add_table(6, 2, Inches(0.95), Inches(1.85), Inches(11.3), Inches(4.4)).table
table.columns[0].width = Inches(5.2)
table.columns[1].width = Inches(6.1)
data = [
    ("环节", "谁做"),
    ("需求拆解、功能取舍", "我"),
    ("写页面、写样式、写接口", "AI"),
    ("数据模型、同步规则", "我定，AI 实现"),
    ("找 bug 的原因", "AI 给线索，我拍板"),
    ("能不能上线", "跑脚本验证，不靠感觉"),
]
for r in range(len(data)):
    table.rows[r].height = Inches(0.72)

for r, (a, b) in enumerate(data):
    for c, val in enumerate((a, b)):
        cell = table.cell(r, c)
        cell.text = ""
        p = cell.text_frame.paragraphs[0]
        run = p.add_run()
        run.text = val
        set_font(run, 16 if r else 15, r == 0 or c == 0, WHITE if r == 0 else INK)
        cell.fill.solid()
        cell.fill.fore_color.rgb = BRAND if r == 0 else (WHITE if r % 2 else LIGHT)
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE
        cell.margin_left = Inches(0.18)

# 11 结果
s = page("做出来的东西", "数字都是实际数过的", "10 / 13")
stats = [("15", "个页面"), ("3", "种运行模式"), ("6", "次部署尝试"), ("1.0", "秒内响应")]
x = 0.95
for num, label in stats:
    textbox(s, x, 2.05, 2.9, 0.9, num, 46, True, BRAND)
    textbox(s, x, 2.95, 2.9, 0.4, label, 15, False, MUTED)
    x += 2.95
textbox(
    s, 0.95, 3.85, 11.3, 2.2,
    "功能：注册登录、新鲜事、相册、日志、留言板、好友、私信、兴趣圈、搭子、同频匹配、资料库、管理后台。\n"
    "数据存在云端，手机和电脑看到的是同一份。",
    17, False, INK, spacing=1.7,
)

# 12 反思
s = page("做完之后的三点想法", "", "11 / 13")
bullets(
    s,
    [
        "写代码变便宜了，判断变贵了｜生成一段代码只要几秒，判断它能不能上线要半小时",
        "AI 不会替你想“边界”｜删除、断网、重复点击、两个人同时改，这些它都不主动提",
        "最值钱的是验收标准｜能说清“什么样算做完”，AI 才有用；说不清，它只会给你一堆看起来对的代码",
    ],
    top=2.05,
    size=19,
    gap=1.05,
)

# 13 收尾
s = prs.slides.add_slide(BLANK)
bg = s.shapes.add_shape(1, 0, 0, prs.slide_width, prs.slide_height)
bg.fill.solid()
bg.fill.fore_color.rgb = LIGHT
bg.line.fill.background()
textbox(s, 1.0, 2.6, 11, 0.8, "工具会一直变", 40, True)
textbox(s, 1.0, 3.5, 11, 1.4, "能说清“做成什么样”，才是自己的本事。", 26, False, INK)
textbox(s, 1.0, 6.3, 11, 0.4, "橡遇 XIANGYU · xiangyu-pve.pages.dev", 14, False, MUTED)

prs.save("橡遇-人机协作记录.pptx")
print("已生成，幻灯片数：", len(prs.slides.__iter__.__self__._sldIdLst))
