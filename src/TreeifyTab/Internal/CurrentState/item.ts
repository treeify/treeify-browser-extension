import {List} from 'immutable'
import {assert, assertNeverType, assertNonUndefined} from 'src/Common/Debug/assert'
import {integer} from 'src/Common/integer'
import {ItemId, ItemType, TOP_ITEM_ID} from 'src/TreeifyTab/basicType'
import {External} from 'src/TreeifyTab/External/External'
import {CurrentState} from 'src/TreeifyTab/Internal/CurrentState/index'
import {Internal} from 'src/TreeifyTab/Internal/Internal'
import {ItemPath} from 'src/TreeifyTab/Internal/ItemPath'
import {PropertyPath} from 'src/TreeifyTab/Internal/PropertyPath'
import {Cite, createDefaultEdge, Edge} from 'src/TreeifyTab/Internal/State'
import {Timestamp} from 'src/TreeifyTab/Timestamp'

/**
 * 指定されたアイテムに関するデータを削除する。
 * 削除によって親の数が0になった子アイテムも再帰的に削除する。
 * キャレットの移動（ターゲットアイテムの変更）は行わない。
 */
export function deleteItem(itemId: ItemId) {
  assert(itemId !== TOP_ITEM_ID)

  Internal.instance.searchEngine.deleteSearchIndex(itemId)

  const item = Internal.instance.state.items[itemId]
  for (const childItemId of item.childItemIds) {
    if (CurrentState.countParents(childItemId) === 1) {
      // 親を1つしか持たない子アイテムは再帰的に削除する
      deleteItem(childItemId)
    } else {
      // 親を2つ以上持つ子アイテムは整合性のために親リストを修正する
      Internal.instance.delete(PropertyPath.of('items', childItemId, 'parents', itemId))
    }
  }

  // 削除されるアイテムを親アイテムの子リストから削除する
  for (const parentItemId of CurrentState.getParentItemIds(itemId)) {
    modifyChildItems(parentItemId, (itemIds) => itemIds.remove(itemIds.indexOf(itemId)))
  }

  // 対応するタブがあれば閉じる
  const tabId = External.instance.tabItemCorrespondence.getTabIdBy(itemId)
  if (tabId !== undefined) {
    External.instance.tabItemCorrespondence.untieTabAndItemByTabId(tabId)
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
    case ItemType.IMAGE:
      CurrentState.deleteImageItemEntry(itemId)
      break
    case ItemType.CODE_BLOCK:
      CurrentState.deleteCodeBlockItemEntry(itemId)
      break
    case ItemType.TEX:
      CurrentState.deleteTexItemEntry(itemId)
      break
    default:
      assertNeverType(itemType)
  }

  CurrentState.unmountPage(itemId)
  CurrentState.turnIntoNonPage(itemId)

  CurrentState.deleteItemEntry(itemId)
  CurrentState.recycleItemId(itemId)
}

/**
 * 指定されたアイテムに関するデータを削除する。
 * 子アイテムは親アイテムの子リストに移動する。
 * キャレットの移動（ターゲットアイテムの変更）は行わない。
 */
export function deleteItemItself(itemId: ItemId) {
  assert(itemId !== TOP_ITEM_ID)

  Internal.instance.searchEngine.deleteSearchIndex(itemId)

  const item = Internal.instance.state.items[itemId]
  const childItemIds = item.childItemIds

  // 全ての子アイテムの親リストから自身を削除し、代わりに自身の親リストを挿入する
  for (const childItemId of childItemIds) {
    const parents = Internal.instance.state.items[childItemId].parents
    const parent = parents[itemId]
    delete parents[itemId]
    for (const parentsKey in item.parents) {
      parents[parentsKey] = {...parent}
    }
  }

  // 全ての親アイテムの子リストから自身を削除し、代わりに自身の子リストを挿入する
  for (const parentItemId of CurrentState.getParentItemIds(itemId)) {
    modifyChildItems(parentItemId, (itemIds) => {
      const index = itemIds.indexOf(itemId)
      assert(index !== -1)
      return itemIds.splice(index, 1, ...childItemIds)
    })
  }

  // 対応するタブがあれば閉じる
  const tabId = External.instance.tabItemCorrespondence.getTabIdBy(itemId)
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
    case ItemType.IMAGE:
      CurrentState.deleteImageItemEntry(itemId)
      break
    case ItemType.CODE_BLOCK:
      CurrentState.deleteCodeBlockItemEntry(itemId)
      break
    case ItemType.TEX:
      CurrentState.deleteTexItemEntry(itemId)
      break
    default:
      assertNeverType(itemType)
  }

  CurrentState.unmountPage(itemId)
  CurrentState.turnIntoNonPage(itemId)

  CurrentState.deleteItemEntry(itemId)
  CurrentState.recycleItemId(itemId)
}

/** Stateのitemsオブジェクトから指定されたアイテムIDのエントリーを削除する */
export function deleteItemEntry(itemId: ItemId) {
  Internal.instance.delete(PropertyPath.of('items', itemId))
}

/** 指定されたIDのアイテムが存在するかどうかを調べる */
export function isItem(itemId: ItemId): boolean {
  return undefined !== Internal.instance.state.items[itemId]
}

/** 与えられたアイテムがメインエリア上で表示する子アイテムのリストを返す */
export function getDisplayingChildItemIds(itemPath: ItemPath): List<ItemId> {
  const itemId = ItemPath.getItemId(itemPath)
  const item = Internal.instance.state.items[itemId]

  // アクティブページはisCollapsedフラグの状態によらず子を強制的に表示する
  if (itemPath.size === 1) {
    return item.childItemIds
  }

  if (CurrentState.getIsCollapsed(itemPath) || CurrentState.isPage(itemId)) {
    return List.of()
  } else {
    return item.childItemIds
  }
}

/** 指定されたアイテムのisCollapsedフラグを設定する */
export function setIsCollapsed(itemPath: ItemPath, isCollapsed: boolean) {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  assertNonUndefined(parentItemId)
  Internal.instance.mutate(
    isCollapsed,
    PropertyPath.of('items', itemId, 'parents', parentItemId, 'isCollapsed')
  )
}

/**
 * 指定されたアイテムのisCollapsedフラグを返す。
 * 親アイテムに依存するのでItemIdではなくItemPathを取る。
 */
export function getIsCollapsed(itemPath: ItemPath): boolean {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  assertNonUndefined(parentItemId)
  return Internal.instance.state.items[itemId].parents[parentItemId].isCollapsed
}

/** 指定されたアイテムのタイムスタンプを現在時刻に更新する */
export function updateItemTimestamp(itemId: ItemId) {
  Internal.instance.mutate(Timestamp.now(), PropertyPath.of('items', itemId, 'timestamp'))
}

/** 指定されたアイテムの親アイテムIDのリストを返す */
export function getParentItemIds(itemId: ItemId): List<ItemId> {
  return List(Object.keys(Internal.instance.state.items[itemId].parents)).map((key) =>
    parseInt(key)
  )
}

/** 指定されたアイテムの親の数を返す */
export function countParents(itemId: ItemId): integer {
  return Object.keys(Internal.instance.state.items[itemId].parents).length
}

/** 指定されたアイテムに親アイテムを追加する */
export function addParent(itemid: ItemId, parentItemId: ItemId, edge?: Edge) {
  Internal.instance.mutate(
    edge ?? createDefaultEdge(),
    PropertyPath.of('items', itemid, 'parents', parentItemId)
  )
}

/**
 * 指定されたアイテムの子アイテムリストを修正する。
 * @param itemId このアイテムの子アイテムリストを修正する
 * @param f 子アイテムリストを受け取って新しい子アイテムリストを返す関数
 */
export function modifyChildItems(itemId: ItemId, f: (itemIds: List<ItemId>) => List<ItemId>) {
  const childItemIds = Internal.instance.state.items[itemId].childItemIds
  Internal.instance.mutate(f(childItemIds), PropertyPath.of('items', itemId, 'childItemIds'))
}

/**
 * あるアイテムの最初の子になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * @param itemId このアイテムの最初の子として追加する
 * @param newItemId 最初の子として追加されるアイテム
 * @param edge 設定するエッジデータ。指定無しならデフォルトのエッジデータが設定される
 */
export function insertFirstChildItem(itemId: ItemId, newItemId: ItemId, edge?: Edge) {
  // 子リストの先頭に追加する
  modifyChildItems(itemId, (itemIds) => itemIds.unshift(newItemId))

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  CurrentState.addParent(newItemId, itemId, edge)
}

/**
 * あるアイテムの最後の子になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * @param itemId このアイテムの最後の子として追加する
 * @param newItemId 最後の子として追加されるアイテム
 * @param edge 設定するエッジデータ。指定無しならデフォルトのエッジデータが設定される
 */
export function insertLastChildItem(itemId: ItemId, newItemId: ItemId, edge?: Edge) {
  // 子リストの末尾に追加する
  modifyChildItems(itemId, (itemIds) => itemIds.push(newItemId))

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  CurrentState.addParent(newItemId, itemId, edge)
}

/**
 * あるアイテムの兄になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * 何らかの理由で兄として追加できない場合は何もしない。
 * @param itemPath アイテム追加の基準となるアイテムパス。このアイテムの弟になる
 * @param newItemId 兄として追加されるアイテム
 * @param edge 設定するエッジデータ。指定無しならデフォルトのエッジデータが設定される
 */
export function insertPrevSiblingItem(
  itemPath: ItemPath,
  newItemId: ItemId,
  edge?: Edge
): ItemPath {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  // 親が居ない場合はこの関数を呼んではならない
  assertNonUndefined(parentItemId)

  const childItemIds = Internal.instance.state.items[parentItemId].childItemIds
  assert(childItemIds.contains(itemId))

  // 兄として追加する
  modifyChildItems(parentItemId, (itemIds) => {
    return itemIds.insert(itemIds.indexOf(itemId), newItemId)
  })

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  CurrentState.addParent(newItemId, parentItemId, edge)

  return ItemPath.createSiblingItemPath(itemPath, newItemId)!
}

/**
 * あるアイテムの弟になるようアイテムを子リストに追加する。
 * 整合性が取れるように親アイテムリストも修正する。
 * @param itemPath アイテム追加の基準となるアイテムパス。このアイテムの弟になる
 * @param newItemId 弟として追加されるアイテム
 * @param edge 設定するエッジデータ。指定無しならデフォルトのエッジデータが設定される
 */
export function insertNextSiblingItem(
  itemPath: ItemPath,
  newItemId: ItemId,
  edge?: Edge
): ItemPath {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  // 親が居ない場合はこの関数を呼んではならない
  assertNonUndefined(parentItemId)

  const childItemIds = Internal.instance.state.items[parentItemId].childItemIds
  assert(childItemIds.contains(itemId))

  // 弟として追加する
  modifyChildItems(parentItemId, (itemIds) => {
    return itemIds.insert(itemIds.indexOf(itemId) + 1, newItemId)
  })

  // 子リストへの追加に対して整合性が取れるように親リストにも追加する
  CurrentState.addParent(newItemId, parentItemId, edge)

  return ItemPath.createSiblingItemPath(itemPath, newItemId)!
}

/**
 * 指定されたアイテムパスの（ドキュメント順で）下にアイテムを配置する。
 * 基本的には弟になるよう配置するが、
 * 指定されたアイテムパスが子を表示している場合は最初の子になるよう配置する。
 */
export function insertBelowItem(itemPath: ItemPath, newItemId: ItemId, edge?: Edge): ItemPath {
  if (!CurrentState.getDisplayingChildItemIds(itemPath).isEmpty() || itemPath.size === 1) {
    insertFirstChildItem(ItemPath.getItemId(itemPath), newItemId, edge)
    return itemPath.push(newItemId)
  } else {
    return insertNextSiblingItem(itemPath, newItemId, edge)
  }
}

/**
 * アイテムの親子関係グラフにおけるエッジを削除する。
 * もし親の数が0になったとしてもそのアイテムの削除は行わない。
 * 引数のアイテムが親子関係になかった場合の動作は未定義。
 * 戻り値は削除されたエッジオブジェクト。
 */
export function removeItemGraphEdge(parentItemId: ItemId, itemId: ItemId): Edge {
  // 親アイテムの子アイテムリストからアイテムを削除する
  modifyChildItems(parentItemId, (itemIds) => itemIds.remove(itemIds.indexOf(itemId)))

  const edge = Internal.instance.state.items[itemId].parents[parentItemId]
  // アイテムの親リストから親アイテムを削除する
  Internal.instance.delete(PropertyPath.of('items', itemId, 'parents', parentItemId))
  return edge
}

/** 新しい未使用のアイテムIDを取得・使用開始する */
export function obtainNewItemId(): ItemId {
  const availableItemIds = Internal.instance.state.availableItemIds
  const last = availableItemIds.last(undefined)
  if (last !== undefined) {
    Internal.instance.mutate(availableItemIds.pop(), PropertyPath.of('availableItemIds'))
    return last
  } else {
    const maxItemId = Internal.instance.state.maxItemId
    Internal.instance.mutate(maxItemId + 1, PropertyPath.of('maxItemId'))
    return maxItemId + 1
  }
}

/** 使われなくなったアイテムIDを登録する */
export function recycleItemId(itemId: ItemId) {
  const availableItemIds = Internal.instance.state.availableItemIds
  Internal.instance.mutate(availableItemIds.push(itemId), PropertyPath.of('availableItemIds'))
}

/** 指定されたアイテムのCSSクラスリストを上書き設定する */
export function setCssClasses(itemId: ItemId, cssClasses: List<string>) {
  Internal.instance.mutate(cssClasses, PropertyPath.of('items', itemId, 'cssClasses'))
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
    Internal.instance.mutate(
      cssClasses.push(cssClass),
      PropertyPath.of('items', itemId, 'cssClasses')
    )
  } else {
    Internal.instance.mutate(
      cssClasses.remove(index),
      PropertyPath.of('items', itemId, 'cssClasses')
    )
  }
}

export function setCite(itemId: ItemId, cite: Cite) {
  Internal.instance.mutate(cite, PropertyPath.of('items', itemId, 'cite'))
}
