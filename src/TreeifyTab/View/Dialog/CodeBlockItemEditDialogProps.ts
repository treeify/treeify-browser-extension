import {assertNonNull} from 'src/Common/Debug/assert'
import {detectLanguage} from 'src/TreeifyTab/highlightJs'
import {CurrentState} from 'src/TreeifyTab/Internal/CurrentState'
import {InputId} from 'src/TreeifyTab/Internal/InputId'
import {ItemPath} from 'src/TreeifyTab/Internal/ItemPath'
import {NullaryCommand} from 'src/TreeifyTab/Internal/NullaryCommand'
import {CodeBlockItemEditDialog} from 'src/TreeifyTab/Internal/State'
import {Rerenderer} from 'src/TreeifyTab/Rerenderer'

export type CodeBlockItemEditDialogProps = CodeBlockItemEditDialog & {
  onClickFinishButton: () => void
  onClickCancelButton: () => void
  onCloseDialog: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

export function createCodeBlockItemEditDialogProps(
  dialog: CodeBlockItemEditDialog
): CodeBlockItemEditDialogProps {
  const targetItemPath = CurrentState.getTargetItemPath()
  const onClickFinishButton = () => {
    const targetItemId = ItemPath.getItemId(targetItemPath)

    const editBox = document.querySelector<HTMLDivElement>('.code-block-edit-dialog_code')
    assertNonNull(editBox)
    const code = editBox.textContent ?? ''

    if (code.trim() !== '') {
      // コードが空でない場合

      // コードを更新
      CurrentState.setCodeBlockItemCode(targetItemId, code)
      // 言語を自動検出
      CurrentState.setCodeBlockItemLanguage(targetItemId, detectLanguage(code))
      // タイムスタンプを更新
      CurrentState.updateItemTimestamp(targetItemId)
    } else {
      // コードが空の場合

      // コードブロックアイテムを削除
      NullaryCommand.removeEdge()
    }

    // ダイアログを閉じる
    CurrentState.setDialog(null)
    Rerenderer.instance.rerender()
  }

  return {
    ...dialog,
    onClickFinishButton,
    onClickCancelButton: () => {
      // ダイアログを閉じる
      CurrentState.setDialog(null)
      onCloseDialog()
      Rerenderer.instance.rerender()
    },
    onCloseDialog,
    onKeyDown: (event) => {
      switch (InputId.fromKeyboardEvent(event)) {
        case '1000Enter':
          onClickFinishButton()
          break
      }
    },
  }
}

function onCloseDialog() {
  if (CurrentState.isEmptyCodeBlockItem(ItemPath.getItemId(CurrentState.getTargetItemPath()))) {
    NullaryCommand.deleteItem()
  }
}
