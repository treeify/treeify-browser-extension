import {State, WebPageItemTitleSettingDialog} from 'src/TreeifyWindow/Internal/State'
import {styleMap} from 'lit-html/directives/style-map'
import {html} from 'lit-html'
import {CurrentState} from 'src/TreeifyWindow/Internal/CurrentState'
import {doWithErrorHandling} from 'src/Common/Debug/report'
import {ItemTreeContentView} from 'src/TreeifyWindow/View/ItemTree/ItemTreeContentView'
import {External} from 'src/TreeifyWindow/External/External'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {Internal} from 'src/TreeifyWindow/Internal/Internal'

export type WebPageItemTitleSettingDialogViewModel = {
  webPageItemTitleSettingDialog: WebPageItemTitleSettingDialog
  /** タイトル入力欄のテキストの初期値 */
  initialTitle: string
  onKeyDown: (event: KeyboardEvent) => void
}

export function createWebPageItemTitleSettingDialogViewModel(
  state: State
): WebPageItemTitleSettingDialogViewModel | undefined {
  if (state.webPageItemTitleSettingDialog === null) return undefined

  const targetItemPath = state.pages[state.activePageId].targetItemPath
  const targetItemId = ItemPath.getItemId(targetItemPath)
  const webPageItem = Internal.instance.state.webPageItems[targetItemId]

  return {
    webPageItemTitleSettingDialog: state.webPageItemTitleSettingDialog,
    initialTitle: webPageItem.title ?? webPageItem.tabTitle,
    onKeyDown: (event) => {
      doWithErrorHandling(() => {
        if (event.isComposing) return

        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          if (event.target.value === '') {
            // 入力欄が空の状態でEnterキーを押したらタイトル設定を削除する
            CurrentState.setWebPageItemTitle(targetItemId, null)
          } else {
            CurrentState.setWebPageItemTitle(targetItemId, event.target.value)
          }
          // タイトル設定ダイアログを閉じる
          CurrentState.setWebPageItemTitleSettingDialog(null)

          // フォーカスを戻す
          const domElementId = ItemTreeContentView.focusableDomElementId(targetItemPath)
          External.instance.requestFocusAfterRendering(domElementId)

          CurrentState.commit()
        }
      })
    },
  }
}

export function WebPageItemTitleSettingDialogView(
  viewModel: WebPageItemTitleSettingDialogViewModel
) {
  const style = styleMap({
    left: `${viewModel.webPageItemTitleSettingDialog.targetItemRect.left}px`,
    top: `${viewModel.webPageItemTitleSettingDialog.targetItemRect.top}px`,
    width: `${viewModel.webPageItemTitleSettingDialog.targetItemRect.width}px`,
    height: `${viewModel.webPageItemTitleSettingDialog.targetItemRect.height}px`,
  })
  return html`
    <div id="web-page-item-title-setting-dialog" style=${style}>
      <input
        type="text"
        class="web-page-item-title-setting-dialog_text-box"
        value=${viewModel.initialTitle}
        @keydown=${viewModel.onKeyDown}
      />
    </div>
  `
}
