// 兴趣圈（分类）与标签池。注意：这里只有“分类”，没有任何假用户。
export const CAMPUSES = ['崂山校区', '四方校区', '高密校区']
export const GRADES = ['大一', '大二', '大三', '大四', '研一', '研二', '研三']
export const STYLES = ['慢热', '话痨', '线上活跃', '线下社恐', '随缘']

export const TAG_POOL = [
  '羽毛球', '篮球', '夜跑', '健身', '骑行',
  '四级', '六级', '考研', '自习', '实验室',
  '编程', '开源', '人工智能', '电子DIY',
  '摇滚', '民谣', '吉他', '唱歌', 'livehouse',
  '摄影', '插画', '手账', '文学', '电影',
  '剧本杀', '桌游', '电竞', '动漫', '二次元',
  '咖啡', '探店', '美食', '烘焙', '滑板',
  '旅行', '露营', '爬山', '志愿', '辩论',
]

export const TOPIC_POOL = [
  '音乐', '运动', '技术', '读书', '电影', '游戏',
  '美食', '旅行', '科研', '毕业去向', '校园生活', '自我管理',
]

// 圈子是产品自带的分类，不是用户。人数从 0 开始，谁加入谁 +1。
export const CIRCLES = [
  {
    slug: 'study', name: '学习考证', emoji: '🎓', category: '学习考证', tone: 'violet',
    desc: '四级六级、考研期末、教资考证。一个人容易摆烂，一群人能卷起来。',
    tags: ['四级', '考研', '自习'], members: 0,
    rules: '不卖课、不拉私域、不催命式打卡。晒进度可以，贩卖焦虑不行。',
  },
  {
    slug: 'sport', name: '运动健身', emoji: '🏸', category: '运动健身', tone: 'mint',
    desc: '羽毛球、夜跑、篮球、健身房。缺人的时候，最需要的就是一个「来」。',
    tags: ['羽毛球', '夜跑', '篮球'], members: 0,
    rules: '约球先说人数和场地，放鸽子提前两小时讲一声就行。',
  },
  {
    slug: 'art', name: '文艺生活', emoji: '🎸', category: '文艺生活', tone: 'rose',
    desc: '吉他、摄影、乐队、读书会。会一点和不会一点的人，都能在这里开个头。',
    tags: ['吉他', '摄影', '读书'], members: 0,
    rules: '可以菜，但别装；可以夸，但别捧杀。',
  },
  {
    slug: 'tech', name: '技术极客', emoji: '💻', category: '技术极客', tone: 'blue',
    desc: '写代码、做开源、打竞赛、搞 AI。青科的实验室和宿舍，都能卷出东西。',
    tags: ['编程', '开源', '人工智能'], members: 0,
    rules: '提问先自己搜过；答案能公开就公开，别私聊藏技术。',
  },
  {
    slug: 'game', name: '游戏电竞', emoji: '🎮', category: '游戏电竞', tone: 'amber',
    desc: '剧本杀、桌游、开黑。五缺一的时候，这个圈子比摇人快。',
    tags: ['剧本杀', '桌游', '电竞'], members: 0,
    rules: '拒绝通宵连坐式开黑；输赢都能笑的人才长期。',
  },
  {
    slug: 'food', name: '吃喝玩乐', emoji: '🍜', category: '吃喝玩乐', tone: 'orange',
    desc: '二餐三楼、南门小吃、手冲咖啡。吃饭这件事，两个人比一个人香。',
    tags: ['美食', '探店', '咖啡'], members: 0,
    rules: 'AA 说清楚；不劝酒；店难吃可以骂，人别骂。',
  },
  {
    slug: 'outdoor', name: '户外旅行', emoji: '⛰️', category: '户外旅行', tone: 'teal',
    desc: '骑行、爬山、露营、看海。崂山就在旁边，周末别只躺宿舍。',
    tags: ['骑行', '旅行', '爬山'], members: 0,
    rules: '出行先看天气和装备清单；不逞强，不单独行动。',
  },
  {
    slug: 'volunteer', name: '志愿公益', emoji: '🌱', category: '志愿公益', tone: 'green',
    desc: '支教、环保、活动志愿者。想认识点不一样的人，从这里开始。',
    tags: ['志愿', '公益', '支教'], members: 0,
    rules: '不为了志愿时长糊弄；答应的事就出现在现场。',
  },
]

export const CIRCLE_CATEGORIES = ['全部', ...CIRCLES.map((c) => c.category)]

// 新用户注册时，标签从 0 开始选，不预填。
export function blankState() {
  return {
    version: 2,
    users: [],
    sessionId: null,
    sessionExpiresAt: 0,
    circles: CIRCLES.map((c) => ({ ...c })),
    circleMembers: {},
    buddies: [],
    requestLog: [],
    friendPairs: [],
    // 会话是“两个人共享”的，不是各自的抽屉：这样同一台设备上的两个账号才能真的聊起来
    convStore: { conversations: [], messages: {} },
    announcement: null,
    // 校内网那套：新鲜事、相册、日志、留言板、访客
    posts: [],
    albums: [],
    diaries: [],
    guestbook: [],
    visits: [],
    materials: [],
    aiByUser: {},
    settingsByUser: {},
    // 以下为派生字段，load 时会被 recompute
    me: null,
    people: [],
    conversations: [],
    messages: {},
    myCircles: [],
    friends: [],
    requests: [],
    ai: { date: '', used: 0 },
    settings: { searchable: true, allowRandom: true },
  }
}
