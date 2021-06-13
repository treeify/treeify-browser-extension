import {is, List} from 'immutable'
import {assertNonUndefined} from 'src/Common/Debug/assert'
import {ItemId} from 'src/TreeifyWindow/basicType'
import {Derived} from 'src/TreeifyWindow/Internal/Derived/index'
import {getContentAsPlainText} from 'src/TreeifyWindow/Internal/importAndExport'
import {Internal} from 'src/TreeifyWindow/Internal/Internal'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {get, join} from 'src/TreeifyWindow/svelte'
import {derived, Readable} from 'svelte/store'

/** 指定されたアイテムがページかどうかを返す */
export function isPage(itemId: ItemId): Readable<boolean> {
  return derived(Internal.instance.pageIdsWritable, (pageIds) => {
    return pageIds.has(itemId)
  })
}

export function getTargetItemPath(): Readable<ItemPath> {
  const activePageId = Internal.instance.getActivePageId()
  const nestedStore = derived(activePageId, (activePageId) => {
    return Internal.instance.state.pages[activePageId].targetItemPath
  })
  return join(nestedStore)
}

export function getAnchorItemPath(): Readable<ItemPath> {
  const activePageId = Internal.instance.getActivePageId()
  const nestedStore = derived(activePageId, (activePageId) => {
    return Internal.instance.state.pages[activePageId].anchorItemPath
  })
  return join(nestedStore)
}

/**
 * 複数選択されているアイテムのリストを返す。
 * 複数選択されていなければターゲットアイテムパスだけの単一要素リストを返す。
 * 並び順は元の兄弟リスト内での並び順と同じ。
 */
export function getSelectedItemPaths(): Readable<List<ItemPath>> {
  const targetItemPath = Derived.getTargetItemPath()
  const anchorItemPath = Derived.getAnchorItemPath()

  return derived([targetItemPath, anchorItemPath], ([targetItemPath, anchorItemPath]) => {
    if (is(targetItemPath, anchorItemPath)) {
      // そもそも複数範囲されていない場合
      return List.of(targetItemPath)
    }

    const parentItemId = ItemPath.getParentItemId(targetItemPath)
    assertNonUndefined(parentItemId)
    const childItemIds = get(Internal.instance.state.items[parentItemId].childItemIds)
    const targetItemIndex = childItemIds.indexOf(ItemPath.getItemId(targetItemPath))
    const anchorItemIndex = childItemIds.indexOf(ItemPath.getItemId(anchorItemPath))
    const lowerIndex = Math.min(targetItemIndex, anchorItemIndex)
    const upperIndex = Math.max(targetItemIndex, anchorItemIndex)
    const sliced = childItemIds.slice(lowerIndex, upperIndex + 1)
    return sliced.map((itemId) => ItemPath.createSiblingItemPath(targetItemPath, itemId)!)
  })
}

/** Treeifyウィンドウのタイトルとして表示する文字列を返す */
export function generateTreeifyWindowTitle(): Readable<string> {
  const activePageId = Internal.instance.getActivePageId()
  return derived(activePageId, (activePageId) => {
    return getContentAsPlainText(activePageId)
  })
}