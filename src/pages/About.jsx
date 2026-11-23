import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

const TIMELINE = [
  {
    date: '11.04',
    title: '定方向：不做第二个校园墙',
    body: '先拆需求，再写代码。问题被拆成三件事：找资料、找学伴、组圈子。名字用「橡」呼应学校橡胶特色，谐音「相遇」。',
    ai: 'AI 出过 12 个名字候选和 4 种信息架构，人工砍掉 11 个名字、推翻 3 套架构。',
  },
  {
    date: '11.05',
    title: '核心闭环：注册 → 圈子 → 搭子',
    body: '账号体系落地：密码加盐哈希、连续失败锁定、学号打码。兴趣圈与搭子发布上线，发布模板强制写清时间、地点、人数。',
    ai: 'AI 生成表单与校验逻辑；人工补了「弱密码黑名单」和「昵称不能当密码」两条规则。',
  },
  {
    date: '11.06',
    title: '补上社交骨架：动态、相册、日志、好友、私信',
    body: '照校内网的思路补功能：新鲜事、个人主页、相册、日志、留言板、访客。多端同步引擎在这一天踩了两个真坑。',
    ai: 'AI 定位了两个 bug：同步回声导致相册自我复制（28 → 84），以及删除后数据复活。修复方案是远端应用守卫 + 幂等写入。',
  },
  {
    date: '11.13',
    title: '安全与后台：管理员、封禁、文件外置',
    body: '加了管理员面板，所有管理操作在服务端二次校验角色。照片从 JSON 里搬出去独立落盘，避免状态膨胀。',
    ai: 'AI 写了首版管理接口；人工发现「前端藏按钮 ≠ 有权限」，把校验全部挪到服务端。',
  },
  {
    date: '11.13',
    title: '从单机走向多人：零依赖后端 + 实时通道',
    body: 'Node 原生 http 写服务端，不用任何框架。加 SSE 长连接，别人发消息不用刷新就能看到；存储层可切到云端数据库，服务端无状态。',
    ai: 'AI 生成同步协议；人工定义幂等规则（同一 id 重复写入不重复创建），并用脚本验证「连续两次轮询不复活」。',
  },
  {
    date: '11.15',
    title: '定稿与报名',
    body: '去掉所有夸大表述，把「学习圈 + 资料库」提到首页。补齐资料库的版权提示，准备参赛材料。',
    ai: 'AI 写的文案被逐条审查，凡是没做的功能一律删掉。',
  },
]

export default function About() {
  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">关于这个项目</span>
          <h1>开发历程</h1>
          <p>从一句需求到一个能跑的产品，全程与 AI 编程工具协作完成。下面是真实的迭代记录。</p>
        </div>
      </header>

      <div className="twocol">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>时间线</h3>
              <p>12 天，6 个阶段</p>
            </div>
          </div>

          <ol className="timeline">
            {TIMELINE.map((t) => (
              <li key={t.date + t.title}>
                <span className="timeline__dot" />
                <div className="timeline__body">
                  <span className="timeline__date">{t.date}</span>
                  <b>{t.title}</b>
                  <p>{t.body}</p>
                  <p className="timeline__ai">
                    <Icon name="sparkles" size={13} /> {t.ai}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>人和 AI 各做了什么</h3>
              <p>分工是刻意设计的</p>
            </div>
          </div>

          <div className="settingrow">
            <div>
              <b>AI 负责</b>
              <span>脚手架、组件、样式、测试脚本、bug 定位、文案初稿</span>
            </div>
          </div>
          <div className="settingrow">
            <div>
              <b>人负责</b>
              <span>需求取舍、信息架构、数据模型、安全边界、验收标准</span>
            </div>
          </div>
          <div className="settingrow">
            <div>
              <b>验收方式</b>
              <span>每个功能都跑脚本验证，不靠“看起来对”</span>
            </div>
          </div>

          <p className="panel__note">
            <Icon name="shield" size={14} />
            所有 AI 生成的代码都经过人工审查；AI 说“已完成”但实际没跑的，一律重做。
          </p>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel__head">
          <div>
            <h3>技术栈</h3>
            <p>没有重框架，全部可读可改</p>
          </div>
        </div>
        <div className="chiprow">
          {['React 18', 'Vite', 'React Router', 'Node 原生 http', 'SSE 实时通道', 'Supabase / PostgREST', '纯 CSS 设计系统', 'GitHub Pages'].map((t) => (
            <span className="chip chip--violet" key={t}>
              {t}
            </span>
          ))}
        </div>
        <p className="panel__note" style={{ marginTop: 12 }}>
          <Link to="/">回首页</Link> · <Link to="/materials">去看看资料库</Link>
        </p>
      </section>
    </div>
  )
}
