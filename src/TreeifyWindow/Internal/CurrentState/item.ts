import {List} from 'immutable'
import {ItemId, ItemType} from 'src/Common/basicType'
import {assert, assertNeverType} from 'src/Common/Debug/assert'
import {Timestamp} from 'src/Common/Timestamp'
import {PropertyPath} from 'src/TreeifyWindow/Internal/PropertyPath'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {CurrentState} from 'src/TreeifyWindow/Internal/CurrentState/index'
import {External} from 'src/TreeifyWindow/External/External'
import {Internal} from 'src/TreeifyWindow/Internal/Internal'

/**
 * 指定されたアイテムに関するデータを削除する。
 * 削除によって親の数が0になった子アイテムも再帰的に削除する。
 * キャレットの移動（ターゲットアイテムの変更）は行わない。
 */
export function deleteItem(itemId: ItemId) {
  const item = Internal.instance.state.items[itemId]
  for (const childItemId of item.childItemIds) {
    if (Internal.instance.state.items[childItemId].parentItemIds.size === 1) {
      // 親を1つしか持たない子アイテムは再帰的に削除する
      deleteItem(childItemId)
    } else {
      // 親を2つ以上持つ子アイテムは整合性のために親リストを修正する
      modifyParentItems(childItemId, (itemIds) => itemIds.remove(itemIds.indexOf(itemId)))
    }
  }

  // 削除されるアイテムを親アイテムの子リストから削除する
  for (const parentItemId of item.parentItemIds) {
    modifyChildItems(parentItemId, (itemIds) => itemIds.remove(itemIds.indexOf(itemId)))
  }

  // 対応するタブがあれば閉じる
  const tabId = External.instance.itemIdToTabId.get(itemId)
  if (tabId !== undefined) {
    chrome.tabs.remove(tabId)
  }

  // アイテムタイプごとのデータを削除する
  const itemType = item.itemType
  switch (itemType) {
    case ItemType.TEXT:
      CurrentState.deleteTextItemEntry(itemId)
      break
    case ItemType.WEB_PAGE:
      CurrentState.deleteWebPageItemEntry(itemId)
      break
    default:
      assertNeverType(itemType)
  }

  CurrentState.unmountPage(itemId)
  CurrentState.becomeNonPage(itemId)

  CurrentState.deleteItemEntry(itemId)
}

/**
 * 指定されたアイテムに関するデータを削除する。
 * 子アイテムは親アイテムの子リストに移動する。
 * キャレットの移動（ターゲットアイテムの変更）は行わない。
 */
export function deleteItemItself(itemId: ItemId) {
  const item = Internal.instance.state.items[itemId]
  const childItemIds = item.childItemIds
  const parentItemIds = item.parentItemIds

  // 全ての子アイテムの親リストから自身を削除し、代わりに自身の親リストを挿入する
  for (const childItemId of childItemIds) {
    modifyParentItems(childItemId, (itemIds) => {
      const index = itemIds.indexOf(itemId)
      assert(index !== -1)
      return itemIds.splice(index, 1, ...parentItemIds)
    })
  }

  // 全ての親アイテムの子リストから自身を削除し、代わりに自身の子リストを挿入する
  for (const parentItemId of parentItemIds) {
    modifyChildItems(parentItemId, (itemIds) => {
      const index = itemIds.indexOf(itemId)
      assert(index !== -1)
      return itemIds.splice(index, 1, ...childItemIds)
    })
  }

  // 対応するタブがあれば閉じる
  const tabId = External.instance.itemIdToTabId.get(itemId)
  if (tabId !== undefined) {
    chrome.tabs.remove(tabId)
  }

  // アイテムタイプごとのデータを削除する
  const itemType = item.itemType
  switch (itemType) {
    case ItemType.TEXT:
      CurrentState.deleteTextItemEntry(itemId)
      break
    case ItemType.WEB_PAGE:
      CurrentState.deleteWebPageItemEntry(itemId)
      break
    default:
      assertNeverType(itemType)
  }

  CurrentState.unmountPage(itemId)
  CurrentState.becomeNonPage(itemId)

  CurrentState.deleteItemEntry(itemId)
}

/** Stateのitemsオブジェクトから指定されたアイテムIDのエントリーを削除する */
export function deleteItemEntry(itemId: ItemId) {
  delete Internal.instance.state.items[itemId]
  Internal.instance.mutatedPropertyPaths.add(PropertyPath.of('items', itemId))
}

/** 指定されたIDのアイテムが存在するかどうかを調べる */
export function isItem(itemId: ItemId): boolean {
  return undefined !== Internal.instance.state.items[itemId]
}

/** 与えられたアイテムがアイテムツリー上で表示する子アイテムのリストを返す */
export function getDisplayingChildItemIds(itemId: ItemId): List<ItemId> {
  const item = Internal.instance.state.items[itemId]

  // アクティブページはisFoldedフラグの状態によらず子を強制的に表示する
  if (Internal.instance.state.activePageId === itemId) {
    return item.childItemIds
  }

  if (item.isFolded || CurrentState.isPage(itemId)) {
    return List.of()
  } else {
    return item.childItemIds
  }
}

/** 指定されたアイテムのisFoldedフラグを設定する */
export function setIsFolded(itemId: ItemId, isFolded: boolean) {
  Internal.instance.state.items[itemId].isFolded = isFolded
  Internal.instance.mutatedPropertyPaths.add(PropertyPath.of('items', itemId, 'isFolded'))
}

/** 指定されたアイテムのタイムスタンプを現在時刻に更新する */
export function updateItemTimestamp(itemId: ItemId) {
  Internal.instance.state.items[itemId].timestamp = Timestamp.now()
  Internal.instance.mutatedPropertyPaths.add(PropertyPath.of('items', itemId, 'timestamp'))
}

/**
 * 指定されたアイテムの子アイテムリストを修正する。
 * @param itemId このアイテムの子アイテムリストを修正する
 * @param f 子アイテムリストを受け取って新しい子アイテムリストを返す関数
 */
export function modifyChildItems(itemId: ItemId, f: (itemIds: List<ItemId>) => List<ItemId>) {
  const item = Internal.instance.state.items[itemId]
  item.childItemIds = f(item.childItemIds)
  Internal.instance.mutatedPropertyPaths.add(PropertyPath.of('items', itemId, 'childItemIds'))
}

/**
 * 指定されたアイテムの親アイテムリストを修正する。
 * @param itemId このアイテムの親アイテムリストを修正する
 * @param f 親アイテムリストを受け取って新しい親アイテムリストを返す関数
 */
export function modifyParentItems(itemId: ItemId, f: (itemIds: List<ItemId>) => List<ItemId>) {
  const item = Internal.instance.state.items[itemId]
  item.parentItemIds = f(item.parentItemIds)
  Internal.instance.mutatedPropertyPaths.add(PropertyPath.of('items', itemId, 'parentItemIds'))
}

/**
 * あるアイテムの最初の子になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * @param itemId このアイテムの最初の子として追加する
 * @param newItemId 最初の子として追加されるアイテム
 */
export function insertFirstChildItem(itemId: ItemId, newItemId: ItemId) {
  // 子リストの先頭に追加する
  modifyChildItems(itemId, (itemIds) => itemIds.unshift(newItemId))

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  modifyParentItems(newItemId, (itemIds) => itemIds.push(itemId))
}

/**
 * あるアイテムの最後の子になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * @param itemId このアイテムの最後の子として追加する
 * @param newItemId 最後の子として追加されるアイテム
 */
export function insertLastChildItem(itemId: ItemId, newItemId: ItemId) {
  // 子リストの先頭に追加する
  modifyChildItems(itemId, (itemIds) => itemIds.push(newItemId))

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  modifyParentItems(newItemId, (itemIds) => itemIds.push(itemId))
}

/**
 * あるアイテムの兄になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * 何らかの理由で兄として追加できない場合は何もしない。
 * @param itemPath アイテム追加の基準となるアイテムパス。このアイテムの弟になる
 * @param newItemId 兄として追加されるアイテム
 */
export function insertPrevSiblingItem(itemPath: ItemPath, newItemId: ItemId) {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  // 親が居ない（≒ アクティブページアイテムである）場合は何もしない
  if (parentItemId === undefined) return

  const childItemIds = Internal.instance.state.items[parentItemId].childItemIds
  // 親の子リストに自身が含まれない場合、すなわち不正なItemPathの場合は何もしない
  if (!childItemIds.contains(itemId)) return

  // 兄として追加する
  modifyChildItems(parentItemId, (itemIds) => {
    return itemIds.insert(itemIds.indexOf(itemId), newItemId)
  })

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  modifyParentItems(newItemId, (itemIds) => itemIds.push(parentItemId!))
}

/**
 * あるアイテムの弟になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * 何らかの理由で弟として追加できない場合は何もしない。
 * @param itemPath アイテム追加の基準となるアイテムパス。このアイテムの弟になる
 * @param newItemId 弟として追加されるアイテム
 */
export function insertNextSiblingItem(itemPath: ItemPath, newItemId: ItemId) {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  // 親が居ない（≒ アクティブページアイテムである）場合は何もしない
  if (parentItemId === undefined) return

  const childItemIds = Internal.instance.state.items[parentItemId].childItemIds
  // 親の子リストに自身が含まれない場合、すなわち不正なItemPathの場合は何もしない
  if (!childItemIds.contains(itemId)) return

  // 弟として追加する
  modifyChildItems(parentItemId, (itemIds) => {
    return itemIds.insert(itemIds.indexOf(itemId) + 1, newItemId)
  })

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  modifyParentItems(newItemId, (itemIds) => itemIds.push(parentItemId!))
}

/**
 * 指定されたアイテムを兄弟リスト内で兄方向に1つ移動する。
 * 兄弟リストが定義されない場合は何もしない。
 * 長男だった場合も何もしない。
 */
export function moveToPrevSibling(itemPath: ItemPath) {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  // アクティブページである場合は何もしない
  if (parentItemId === undefined) return

  const siblingItemIds = Internal.instance.state.items[parentItemId].childItemIds
  const oldIndex = siblingItemIds.indexOf(itemId)
  // 長男だった場合は何もしない
  if (oldIndex === 0) return

  // 子アイテムリスト内で該当アイテムを1つ移動する
  modifyChildItems(parentItemId, (itemIds) => itemIds.remove(oldIndex).insert(oldIndex - 1, itemId))
}

/**
 * 指定されたアイテムを兄弟リスト内で弟方向に1つ移動する。
 * 兄弟リストが定義されない場合は何もしない。
 * 末弟だった場合も何もしない。
 */
export function moveToNextSibling(itemPath: ItemPath) {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  // アクティブページである場合は何もしない
  if (parentItemId === undefined) return

  const siblingItemIds = Internal.instance.state.items[parentItemId].childItemIds
  const oldIndex = siblingItemIds.indexOf(itemId)
  // 末弟だった場合は何もしない
  if (oldIndex === siblingItemIds.size - 1) return

  // 子アイテムリスト内で該当アイテムを1つ移動する
  modifyChildItems(parentItemId, (itemIds) => itemIds.remove(oldIndex).insert(oldIndex + 1, itemId))
}

/**
 * アイテムの親子関係グラフにおけるエッジを削除する。
 * もし親の数が0になったとしてもそのアイテムの削除は行わない。
 * 引数のアイテムが親子関係になかった場合の動作は未定義。
 */
export function removeItemGraphEdge(parentItemId: ItemId, itemId: ItemId) {
  // 親アイテムの子アイテムリストからアイテムを削除する
  modifyChildItems(parentItemId, (itemIds) => itemIds.remove(itemIds.indexOf(itemId)))

  // アイテムの親リストから親アイテムを削除する
  modifyParentItems(itemId, (itemIds) => itemIds.remove(itemIds.indexOf(parentItemId)))
}

/**
 * 指定されたアイテムを起点とするサブツリーに含まれるアイテムIDを全て返す。
 * ただしページは終端ノードとして扱い、その子孫は無視する。
 */
export function* getSubtreeItemIds(itemId: ItemId): Generator<ItemId> {
  yield itemId

  // ページは終端ノードとして扱う
  if (CurrentState.isPage(itemId)) return

  for (const childItemId of Internal.instance.state.items[itemId].childItemIds) {
    yield* getSubtreeItemIds(childItemId)
  }
}

/** 次に使うべき新しいアイテムIDを設定する */
export function setNextNewItemId(itemId: ItemId) {
  Internal.instance.state.nextNewItemId = itemId
  Internal.instance.mutatedPropertyPaths.add(PropertyPath.of('nextNewItemId'))
}

/**
 * CSSクラスを追加する。
 * 既に追加済みなら削除する。
 */
export function toggleCssClass(itemId: ItemId, cssClass: string) {
  const item = Internal.instance.state.items[itemId]
  const cssClasses = item.cssClasses

  const index = cssClasses.indexOf(cssClass)
  if (index === -1) {
    item.cssClasses = cssClasses.push(cssClass)
  } else {
    item.cssClasses = cssClasses.remove(index)
  }
  Internal.instance.mutatedPropertyPaths.add(PropertyPath.of('items', itemId, 'cssClasses'))
}