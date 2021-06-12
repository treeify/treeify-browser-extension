import {List} from 'immutable'
import {assertNonUndefined} from 'src/Common/Debug/assert'
import {ItemId} from 'src/TreeifyWindow/basicType'
import {Derived} from 'src/TreeifyWindow/Internal/Derived/index'
import {Internal} from 'src/TreeifyWindow/Internal/Internal'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {derived, get as svelteGet, readable, Readable, Unsubscriber} from 'svelte/store'

/** 与えられたアイテムがアイテムツリー上で表示する子アイテムのリストを返す */
export function getDisplayingChildItemIds(itemPath: ItemPath): Readable<List<ItemId>> {
  const itemId = ItemPath.getItemId(itemPath)
  const childItemIds = Internal.instance.state.items[itemId].childItemIds
  // アクティブページはisCollapsedフラグの状態によらず子を強制的に表示する
  if (itemPath.size === 1) {
    return childItemIds
  }

  const isCollapsed = Derived.getIsCollapsed(itemPath)
  const isPage = Derived.isPage(itemId)
  return derived([childItemIds, isCollapsed, isPage], () => {
    if (get(isCollapsed) || get(isPage)) {
      return List.of<ItemId>()
    } else {
      return get(childItemIds)
    }
  })
}

/**
 * 指定されたアイテムのisCollapsedフラグを返す。
 * 親アイテムに依存するのでItemIdではなくItemPathを取る。
 * TODO: 親のないItemPathを与えられた際の挙動をコメントに書く
 */
export function getIsCollapsed(itemPath: ItemPath): Readable<boolean> {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  assertNonUndefined(parentItemId)
  return Internal.instance.state.items[itemId].parents[parentItemId].isCollapsed
}

/**
 * 指定されたアイテムパスの最後のエッジのラベルを返す。
 * 親を持たないアイテムパスの場合、undefinedを返す。
 */
export function getLabels(itemPath: ItemPath): Readable<List<string>> | undefined {
  const itemId = ItemPath.getItemId(itemPath)
  const parentItemId = ItemPath.getParentItemId(itemPath)
  if (parentItemId !== undefined) {
    return Internal.instance.state.items[itemId].parents[parentItemId].labels
  } else {
    return undefined
  }
}

/**
 * Svelte標準のget関数をちょっと柔軟にしたユーティリティ関数。
 * nullやundefinedをいい感じにスルーしてくれる。
 */
export function get<T>(readable: Readable<T>): T
export function get<T>(readable: Readable<T> | undefined | null): T | undefined
export function get<T>(readable: Readable<T> | undefined | null) {
  if (readable === undefined || readable === null) return undefined

  return svelteGet(readable)
}

/** 現在のワークスペースの除外アイテムリストを返す */
export function getExcludedItemIds(): Readable<List<ItemId>> {
  // この関数の呼び出し時点のカレントワークスペースのexcludedItemIdsを返すだけではダメ。
  // ワークスペースが切り替えられたときに、参照先のexcludedItemIdsを切り替えなければならない。
  // 依存先が動的に変化するということなので、derived関数では実現できない（はず）。
  // 下記の実装は参照先のexcludedItemIdsをがんばって動的に切り替えている。
  // 型で表すと Readable<Readable<T>> => Readable<T> という変換に近いことをやっている。

  // 現在参照しているexcludedItemIdsの参照を解除する関数
  let unsubscriber: Unsubscriber | undefined

  const currentWorkspaceId = Internal.instance.getCurrentWorkspaceId()
  const initialValue = get(
    Internal.instance.state.workspaces[get(currentWorkspaceId)].excludedItemIds
  )

  return readable(initialValue, (set) => {
    return currentWorkspaceId.subscribe((currentWorkspaceId) => {
      // 前回登録したサブスクライバーを登録解除する（怠るとメモリリーク）
      unsubscriber?.()

      const excludedItemIds = Internal.instance.state.workspaces[currentWorkspaceId].excludedItemIds
      unsubscriber = excludedItemIds.subscribe((excludedItemIds) => {
        set(excludedItemIds)
      })
    })
  })
}
