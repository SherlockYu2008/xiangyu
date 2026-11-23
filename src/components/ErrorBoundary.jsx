import { Component } from 'react'

/**
 * 兜底：如果按需加载的页面文件加载失败（部署后旧缓存指向了被替换的分包，
 * 或网络抖动），自动刷新一次页面，避免用户看到白屏。
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    const msg = String(error?.message || error)
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Loading chunk')
    if (isChunkError) {
      const key = 'xiangyu.reloaded'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        location.reload()
        return
      }
    }
    console.error('页面出错：', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bootfail">
          <h2>页面加载出错了</h2>
          <p>{String(this.state.error?.message || this.state.error)}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              sessionStorage.removeItem('xiangyu.reloaded')
              location.reload()
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
