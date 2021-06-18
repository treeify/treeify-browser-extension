import CreateData = chrome.windows.CreateData
import UpdateInfo = chrome.windows.UpdateInfo
import {assertNonUndefined} from 'src/Common/Debug/assert'
import {integer} from 'src/Common/integer'
import UAParser from 'ua-parser-js'

export namespace TreeifyWindow {
  const initialWidth = 400

  /**
   * Treeifyウィンドウを開く。
   * すでに開かれている場合はTreeifyウィンドウをフォーカス（最前面化）する。
   */
  export async function open() {
    const treeifyWindowId = await findWindowId()
    if (treeifyWindowId !== undefined) {
      // すでに開かれている場合、ウィンドウをフォーカスする
      await chrome.windows.update(treeifyWindowId, {focused: true})
    } else {
      // Treeifyウィンドウを開く
      await chrome.windows.create(
        fillWindowGaps({
          url: chrome.runtime.getURL('TreeifyWindow/index.html'),
          type: 'popup',
          // TODO: フルウィンドウモードで終了した場合は、次回起動時もフルウィンドウモードになってほしい気がする
          state: 'normal',
          width: readNarrowWidth() ?? initialWidth,
          height: screen.availHeight,
          top: 0,
          left: 0,
        })
      )
    }
  }

  /**
   * TreeifyウィンドウのウィンドウIDを取得する。
   * もしTreeifyウィンドウが存在しない場合はundefinedを返す。
   */
  export async function findWindowId(): Promise<integer | undefined> {
    const windows = await chrome.windows.getAll({populate: true, windowTypes: ['popup']})
    for (const window of windows) {
      if (window.tabs?.length === 1) {
        if (window.tabs[0].url === chrome.runtime.getURL('TreeifyWindow/index.html')) {
          return window.id
        }
      }
    }
    return undefined
  }

  /** デュアルウィンドウモードかどうか判定する */
  export async function isDualWindowMode(): Promise<boolean> {
    const windows = await getAllNormalWindows()
    for (const window of windows) {
      if (window.left === undefined || window.width === undefined) continue
      if (window.top === undefined || window.height === undefined) continue

      const windowRight = window.left + window.width
      const windowBottom = window.top + window.height
      const screenRight = screenX + innerWidth
      const screenBottom = screenY + innerHeight
      const hasOverlap =
        Math.max(screenX, window.left) <= Math.min(screenRight, windowRight) &&
        Math.max(screenY, window.top) <= Math.min(screenBottom, windowBottom)

      if (!hasOverlap) {
        // Treeifyウィンドウと重なっていないブラウザウィンドウが1つでもあればデュアルウィンドウモードと判定する
        return true
      }
    }

    return false
  }

  /** フルウィンドウモードかどうか判定する */
  export async function isFullWindowMode(): Promise<boolean> {
    const windows = await getAllNormalWindows()
    for (const window of windows) {
      if (!isFullSize(window)) return false
    }

    const treeifyWindow = await getTreeifyWindow()
    return isFullSize(treeifyWindow)
  }

  function isFullSize(window: chrome.windows.Window): boolean {
    assertNonUndefined(window.width)
    assertNonUndefined(window.height)
    return (window.width * window.height) / (screen.availWidth * screen.availHeight) >= 0.9
  }

  async function getTreeifyWindow(): Promise<chrome.windows.Window> {
    const windows = await chrome.windows.getAll({populate: true, windowTypes: ['popup']})

    for (const window of windows) {
      if (window.tabs?.length === 1) {
        if (window.tabs[0].url === chrome.runtime.getURL('TreeifyWindow/index.html')) {
          return window
        }
      }
    }
    throw Error('Treeifyウィンドウが見つかりませんでした。')
  }

  /** デュアルウィンドウモードに変更する */
  export async function toDualWindowMode() {
    // Treeifyウィンドウの幅や位置を変更する
    const treeifyWindowId = await findWindowId()
    assertNonUndefined(treeifyWindowId)
    const treeifyWindowWidth = readNarrowWidth() ?? initialWidth
    const treeifyPromise = chrome.windows.update(
      treeifyWindowId,
      fillWindowGaps({
        state: 'normal',
        left: 0,
        top: 0,
        width: treeifyWindowWidth,
        height: screen.availHeight,
      })
    )

    const windows = await getAllNormalWindows()
    const browserPromises = windows.map((window) => {
      if (window.id === undefined) return new Promise(() => {})

      // ブラウザウィンドウの幅や位置を変更する
      return chrome.windows.update(
        window.id,
        fillWindowGaps({
          state: 'normal',
          left: treeifyWindowWidth,
          top: 0,
          width: screen.availWidth - treeifyWindowWidth,
          height: screen.availHeight,
        })
      )
    })

    await Promise.all([treeifyPromise, ...browserPromises])
  }

  /** フルウィンドウモードに変更する */
  export async function toFullWindowMode() {
    // 既にフルウィンドウモードなら何もしない（ちらつき対策）
    if (await isFullWindowMode()) return

    if (new UAParser().getOS().name !== 'Mac OS') {
      // ブラウザウィンドウの幅や位置を変更する
      for (const window of await getAllNormalWindows()) {
        if (window.id === undefined) continue

        chrome.windows.update(window.id, {
          state: 'maximized',
          // 画面がちらつくので本当はfocused: falseにしたいのだがstate: 'maximized'と組み合わせるとエラーになるので妥協
          focused: true,
        })
      }

      // Treeifyウィンドウの幅や位置を変更する
      const treeifyWindowId = await findWindowId()
      assertNonUndefined(treeifyWindowId)
      chrome.windows.update(treeifyWindowId, {
        state: 'maximized',
        focused: true,
      })
    } else {
      // Macではウィンドウの最大化の概念を他OSと別に扱う

      // ブラウザウィンドウの幅や位置を変更する
      for (const window of await getAllNormalWindows()) {
        if (window.id === undefined) continue

        chrome.windows.update(window.id, {
          state: 'normal',
          left: 0,
          top: 0,
          width: screen.availWidth,
          height: screen.availHeight,
          focused: false,
        })
      }

      // Treeifyウィンドウの幅や位置を変更する
      const treeifyWindowId = await findWindowId()
      assertNonUndefined(treeifyWindowId)
      chrome.windows.update(treeifyWindowId, {
        state: 'normal',
        left: 0,
        top: 0,
        width: screen.availWidth,
        height: screen.availHeight,
        focused: true,
      })
    }
  }

  /** @deprecated */
  async function getAllNormalWindows(): Promise<chrome.windows.Window[]> {
    return await chrome.windows.getAll({windowTypes: ['normal']})
  }

  export function writeNarrowWidth(width: integer) {
    localStorage.setItem('treeifyWindowNarrowWidth', width.toString())
  }

  export function readNarrowWidth(): integer | undefined {
    const savedValue = localStorage.getItem('treeifyWindowNarrowWidth')
    if (savedValue === null) return undefined

    return parseInt(savedValue)
  }

  // Windowsでウィンドウの左端、右端、下端に隙間ができる問題への対策用関数
  function fillWindowGaps(rawData: UpdateInfo | CreateData): UpdateInfo | CreateData {
    if (new UAParser().getOS().name === 'Windows') {
      // TODO: おそらく次の式で正確なgapを取得できる
      // mouseEvent.screenX - mouseEvent.clientX
      const gapPx = 8
      const cloned = {...rawData}
      if (cloned.left !== undefined) {
        cloned.left -= gapPx
      }
      if (cloned.width !== undefined) {
        cloned.width += 2 * gapPx
      }
      if (cloned.height !== undefined) {
        cloned.height += gapPx
      }
      return cloned
    }
    return rawData
  }

  /** Treeifyウィンドウ向けのメッセージ型のUnion型 */
  export type Message = OnMouseMoveToLeftEnd | OnMouseEnter

  export type OnMouseMoveToLeftEnd = {
    type: 'OnMouseMoveToLeftEnd'
  }

  export type OnMouseEnter = {
    type: 'OnMouseEnter'
    /** event.screenX */
    x: integer
    /** event.screenY */
    y: integer
  }
}
