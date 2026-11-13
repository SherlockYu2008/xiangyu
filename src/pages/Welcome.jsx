import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon, { Mark } from '../components/Icon'
import { Aurora } from '../components/FX'
import { Tag, useToast } from '../components/ui'
import { BRAND } from '../lib/brand'
import { CAMPUSES, GRADES, TAG_POOL } from '../lib/data'
import { checkStudentNo, strongPassword } from '../lib/auth'
import { login, register, useStore } from '../lib/store'

const EMPTY_FORM = {
  nickname: '',
  password: '',
  password2: '',
  studentNo: '',
  grade: '大二',
  campus: '崂山校区',
  major: '',
  bio: '',
}

export default function Welcome() {
  const nav = useNavigate()
  const toast = useToast()
  const s = useStore()
  const [mode, setMode] = useState(s.users.length ? 'login' : 'register')
  const [form, setForm] = useState(EMPTY_FORM)
  const [tags, setTags] = useState([])
  const [busy, setBusy] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')

  const set = (key) => (e) => {
    setError('')
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const toggleTag = (t) => {
    setError('')
    setTags((list) => {
      if (list.includes(t)) return list.filter((x) => x !== t)
      if (list.length >= 6) {
        toast('最多选 6 个标签')
        return list
      }
      return [...list, t]
    })
  }

  const doLogin = async () => {
    setError('')
    if (!form.nickname.trim() || !form.password) return setError('昵称和密码都要填')
    setBusy(true)
    const res = await login(form.nickname, form.password, remember)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast(`欢迎回来，${form.nickname.trim()}`)
    nav('/')
  }

  const doRegister = async () => {
    setError('')
    const pwErr = strongPassword(form.password, {
      nickname: form.nickname.trim(),
      studentNo: form.studentNo.trim(),
    })
    if (pwErr) return setError(pwErr)
    if (form.password !== form.password2) return setError('两次输入的密码不一致')
    if (!form.nickname.trim()) return setError('先起个昵称')
    if (!form.major.trim()) return setError('填一下专业，同专业的人更容易聊起来')
    if (tags.length < 3) return setError('至少选 3 个兴趣标签，匹配算法才有东西算')
    const noErr = checkStudentNo(form.studentNo.trim())
    if (noErr) return setError(noErr)

    setBusy(true)
    const res = await register({
      nickname: form.nickname.trim(),
      password: form.password,
      studentNo: form.studentNo.trim(),
      grade: form.grade,
      campus: form.campus,
      major: form.major.trim(),
      bio: form.bio.trim() || '刚来橡遇，还没想好写什么。',
      tags,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error)
    toast('注册成功，先去看看兴趣圈')
    nav('/')
  }

  return (
    <div className="welcome">
      <Aurora />
      <div className="welcome__glow" aria-hidden="true" />

      <header className="welcome__top">
        <span className="welcome__logo">
          <Mark size={36} />
          <span>
            <b>{BRAND.name}</b>
            <em>{BRAND.latin}</em>
          </span>
        </span>
        <span className="welcome__school">青岛科技大学 · 校内同频</span>
      </header>

      <div className="welcome__grid">
        <section className="welcome__intro">
          <p className="eyebrow">兴趣圈 · 搭子 · 同频匹配</p>
          <h1>
            在青科，
            <br />
            <em>橡遇</em>同频的你
          </h1>
          <p className="welcome__lead">{BRAND.desc}</p>

          <ul className="welcome__points">
            <li>
              <span className="welcome__pi tone-violet">
                <Icon name="book" size={17} />
              </span>
              <div>
                <b>学习资料库</b>
                <span>课程笔记、课件、真题，按课程分类，传一次全班都能用。</span>
              </div>
            </li>
            <li>
              <span className="welcome__pi tone-blue">
                <Icon name="grid" size={17} />
              </span>
              <div>
                <b>兴趣圈 + 搭子</b>
                <span>四级搭子、羽毛球搭子、考研搭子，按圈子找，不靠缘分。</span>
              </div>
            </li>
            <li>
              <span className="welcome__pi tone-mint">
                <Icon name="sparkles" size={17} />
              </span>
              <div>
                <b>同频算分</b>
                <span>Jaccard 相似度 + 加权规则，纯程序计算，0 元成本。</span>
              </div>
            </li>
          </ul>

          <div className="welcome__pun">
            <div className="welcome__punhead">
              <Icon name="star" size={15} />
              名字的由来：一个青科大专属的谐音梗
            </div>
            <div className="welcome__punlist">
              {BRAND.puns.map((p) => (
                <div key={p.key} className="welcome__punitem">
                  <b>{p.title}</b>
                  <span>{p.text}</span>
                </div>
              ))}
            </div>
            <div className="welcome__alts">
              <span>备选名：</span>
              {BRAND.alts.map((a) => (
                <Tag key={a.name} tone="plain" title={a.note}>
                  {a.name}
                </Tag>
              ))}
            </div>
          </div>
        </section>

        <section className="welcome__card">
          <div className="welcome__tabs">
            <button type="button" className={mode === 'login' ? 'is-on' : ''} onClick={() => { setMode('login'); setError('') }}>
              登录
            </button>
            <button type="button" className={mode === 'register' ? 'is-on' : ''} onClick={() => { setMode('register'); setError('') }}>
              注册
            </button>
          </div>

          {mode === 'login' ? (
            <div className="welcome__form">
              {s.users.length === 0 && (
                <p className="welcome__hint" style={{ textAlign: 'left' }}>
                  这台设备还没有账号，先切到「注册」。
                </p>
              )}
              <label className="field">
                <span>昵称</span>
                <input value={form.nickname} maxLength={20} placeholder="注册时用的昵称" onChange={set('nickname')} />
              </label>
              <label className="field">
                <span>密码</span>
                <input
                  type="password"
                  value={form.password}
                  maxLength={72}
                  placeholder="注册时设的密码"
                  onChange={set('password')}
                  onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                />
              </label>

              <label className="checkline">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                记住我（7 天内免登录；公用电脑请取消）
              </label>

              {error && <p className="form__error">{error}</p>}

              <button type="button" className="btn btn--primary btn--lg btn--block" onClick={doLogin} disabled={busy}>
                {busy ? '正在验证…' : '登录'} <Icon name="arrowRight" size={18} />
              </button>

              <p className="welcome__hint">
                账号只存在这台设备的浏览器里，换设备需要重新注册。
                <br />
                没有找回密码功能，忘了只能重新注册一个。
              </p>
            </div>
          ) : (
            <div className="welcome__form">
              <label className="field">
                <span>昵称</span>
                <input value={form.nickname} maxLength={20} placeholder="别人会看到的名字" onChange={set('nickname')} />
              </label>

              <div className="field-row">
                <label className="field">
                  <span>密码</span>
                  <input type="password" value={form.password} maxLength={72} placeholder="8 位以上，字母+数字" onChange={set('password')} />
                </label>
                <label className="field">
                  <span>确认密码</span>
                  <input type="password" value={form.password2} maxLength={72} placeholder="再输一遍" onChange={set('password2')} />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>年级</span>
                  <select value={form.grade} onChange={set('grade')}>
                    {GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>校区</span>
                  <select value={form.campus} onChange={set('campus')}>
                    {CAMPUSES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span>专业</span>
                <input value={form.major} maxLength={24} placeholder="比如：高分子材料与工程" onChange={set('major')} />
              </label>

              <label className="field">
                <span>
                  学号 <i>选填，存进来就打码，只有你能看到</i>
                </span>
                <input
                  value={form.studentNo}
                  maxLength={14}
                  inputMode="numeric"
                  placeholder="8–14 位数字"
                  onChange={set('studentNo')}
                />
              </label>

              <div className="field">
                <span>
                  兴趣标签 <i>至少 3 个，最多 6 个</i>
                </span>
                <div className="welcome__tagpool">
                  {TAG_POOL.map((t) => (
                    <Tag key={t} tone={tags.includes(t) ? 'brand' : 'plain'} active={tags.includes(t)} onClick={() => toggleTag(t)}>
                      {t}
                    </Tag>
                  ))}
                </div>
              </div>

              <label className="field">
                <span>一句话介绍</span>
                <textarea
                  rows={2}
                  maxLength={120}
                  value={form.bio}
                  placeholder="比如：羽毛球菜鸡，想找固定球搭子"
                  onChange={set('bio')}
                />
              </label>

              {error && <p className="form__error">{error}</p>}

              <button type="button" className="btn btn--primary btn--lg btn--block" onClick={doRegister} disabled={busy}>
                {busy ? '正在创建…' : '注册并进入'} <Icon name="arrowRight" size={18} />
              </button>

              <p className="welcome__hint">
                现在没有短信或学籍核验，账号是「这台设备上的账号」。
                <br />
                要让同学在不同设备上互相看见，需要接后端（Supabase）。
              </p>
            </div>
          )}
        </section>
      </div>

      <footer className="welcome__foot">
        <span>
          © {new Date().getFullYear()} {BRAND.name} · {BRAND.tagline}
        </span>
        <span>数据只存在本机浏览器 · 未连接后端</span>
      </footer>
    </div>
  )
}
