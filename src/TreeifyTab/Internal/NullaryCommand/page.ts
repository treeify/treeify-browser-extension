import {CurrentState} from 'src/TreeifyTab/Internal/CurrentState'
import {ItemPath} from 'src/TreeifyTab/Internal/ItemPath'

/**
 * ターゲットアイテムがページなら非ページ化する。
 * ターゲットアイテムが非ページならページ化する。
 */
export function togglePaged() {
  const targetItemPath = CurrentState.getTargetItemPath()
  // アクティブページに対しては何もしない
  if (targetItemPath.size === 1) return

  const targetItemId = ItemPath.getItemId(targetItemPath)

  if (CurrentState.isPage(targetItemId)) {
    CurrentState.unmountPage(targetItemId)
    CurrentState.turnIntoNonPage(targetItemId)
  } else {
    CurrentState.turnIntoPage(targetItemId)
  }
}

/** 対象アイテムがページなら、そのページに切り替える */
export function showPage() {
  const targetItemId = ItemPath.getItemId(CurrentState.getTargetItemPath())

  if (CurrentState.isPage(targetItemId)) {
    CurrentState.switchActivePage(targetItemId)
  }
}

/** 対象アイテムをページ化し、そのページに切り替える */
export function turnIntoAndShowPage() {
  const targetItemId = ItemPath.getItemId(CurrentState.getTargetItemPath())

  CurrentState.turnIntoPage(targetItemId)
  CurrentState.switchActivePage(targetItemId)
}

/** 対象を非ページ化し、expandする */
export function turnIntoNonPageAndExpand() {
  const targetItemPath = CurrentState.getTargetItemPath()
  // アクティブページに対しては何もしない
  if (targetItemPath.size === 1) return

  const targetItemId = ItemPath.getItemId(targetItemPath)

  CurrentState.unmountPage(targetItemId)
  CurrentState.turnIntoNonPage(targetItemId)

  CurrentState.setIsCollapsed(targetItemPath, false)
  CurrentState.updateItemTimestamp(targetItemId)
}
