import {List} from 'immutable'
import {assertNonUndefined} from 'src/Common/Debug/assert'
import {External} from 'src/TreeifyWindow/External/External'
import {CurrentState} from 'src/TreeifyWindow/Internal/CurrentState'
import {Internal} from 'src/TreeifyWindow/Internal/Internal'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {TreeifyWindow} from 'src/TreeifyWindow/TreeifyWindow'

/** 対象ウェブページアイテムに対応するタブをdiscardする */
export function softUnloadItem() {
  const targetItemPath = CurrentState.getTargetItemPath()

  const tabId = External.instance.tabItemCorrespondence.getTabIdBy(
    ItemPath.getItemId(targetItemPath)
  )
  // 対応するタブがなければ何もしない
  if (tabId === undefined) return

  chrome.tabs.discard(tabId)
}

/** 対象アイテムのサブツリーの各ウェブページアイテムに対応するタブをdiscardする */
export function softUnloadSubtree() {
  const targetItemId = ItemPath.getItemId(CurrentState.getTargetItemPath())

  for (const subtreeItemId of CurrentState.getSubtreeItemIds(targetItemId)) {
    const tabId = External.instance.tabItemCorrespondence.getTabIdBy(subtreeItemId)
    if (tabId !== undefined) {
      chrome.tabs.discard(tabId)
    }
  }
}

/** 対象ウェブページアイテムに対応するタブを閉じる */
export function hardUnloadItem() {
  const targetItemPath = CurrentState.getTargetItemPath()

  const tabId = External.instance.tabItemCorrespondence.getTabIdBy(
    ItemPath.getItemId(targetItemPath)
  )
  // 対応するタブがなければ何もしない
  if (tabId === undefined) return

  // chrome.tabs.onRemovedイベントリスナー内でウェブページアイテムが削除されないよう根回しする
  External.instance.hardUnloadedTabIds.add(tabId)

  chrome.tabs.remove(tabId)
}

/** 対象アイテムのサブツリーの各ウェブページアイテムに対応するタブを閉じる */
export function hardUnloadSubtree() {
  const targetItemId = ItemPath.getItemId(CurrentState.getTargetItemPath())

  for (const subtreeItemId of CurrentState.getSubtreeItemIds(targetItemId)) {
    const tabId = External.instance.tabItemCorrespondence.getTabIdBy(subtreeItemId)
    if (tabId !== undefined) {
      // chrome.tabs.onRemovedイベントリスナー内でウェブページアイテムが削除されないよう根回しする
      External.instance.hardUnloadedTabIds.add(tabId)

      // 対応するタブを閉じる
      chrome.tabs.remove(tabId)
    }
  }
}

/** ウェブページアイテムのロード操作 */
export function loadItem() {
  const targetItemId = ItemPath.getItemId(CurrentState.getTargetItemPath())
  const tabId = External.instance.tabItemCorrespondence.getTabIdBy(targetItemId)
  // 対応するタブがあれば何もしない。
  // discarded状態のタブをバックグラウンドで非discarded化できれば望ましいのだがそのようなAPIが見当たらない。
  if (tabId !== undefined) return

  const webPageItem = Internal.instance.state.webPageItems[targetItemId]
  const url = webPageItem.url
  const itemIds = External.instance.urlToItemIdsForTabCreation.get(url) ?? List.of()
  External.instance.urlToItemIdsForTabCreation.set(url, itemIds.push(targetItemId))
  chrome.tabs.create({url, active: false})
}

/** ウェブページアイテムのサブツリーロード操作 */
export function loadSubtree() {
  const targetItemId = ItemPath.getItemId(CurrentState.getTargetItemPath())
  for (const subtreeItemId of CurrentState.getSubtreeItemIds(targetItemId)) {
    const tabId = External.instance.tabItemCorrespondence.getTabIdBy(subtreeItemId)
    if (tabId === undefined) {
      const url = Internal.instance.state.webPageItems[subtreeItemId].url
      const itemIds = External.instance.urlToItemIdsForTabCreation.get(url) ?? List.of()
      External.instance.urlToItemIdsForTabCreation.set(url, itemIds.push(subtreeItemId))
      chrome.tabs.create({url, active: false})
    }
  }
}

/**
 * ウェブページアイテムに対応するタブを最前面化する。
 * 存在しない場合はタブを開く。
 */
export function browseTab() {
  const targetItemPath = CurrentState.getTargetItemPath()
  const targetItemId = ItemPath.getItemId(targetItemPath)

  const tabId = External.instance.tabItemCorrespondence.getTabIdBy(targetItemId)
  if (tabId !== undefined) {
    // ウェブページアイテムに対応するタブを最前面化する
    assertNonUndefined(tabId)
    chrome.tabs.update(tabId, {active: true})
    const tab = External.instance.tabItemCorrespondence.getTab(tabId)
    assertNonUndefined(tab)
    chrome.windows.update(tab.windowId, {focused: true})
  } else {
    // 対応するタブがなければ開く
    const url = Internal.instance.state.webPageItems[targetItemId].url
    const itemIds = External.instance.urlToItemIdsForTabCreation.get(url) ?? List.of()
    External.instance.urlToItemIdsForTabCreation.set(url, itemIds.push(targetItemId))
    chrome.tabs.create({url, active: true}, (tab) => {
      chrome.windows.update(tab.windowId, {focused: true})
    })
  }
}

/**
 * デュアルウィンドウモードに変更しつつ、ウェブページアイテムに対応するタブを最前面化する。
 * 対応するタブが存在しない場合は新たにタブを開く。
 */
export function browseTabInDualWindowMode() {
  TreeifyWindow.toDualWindowMode()

  browseTab()
}
