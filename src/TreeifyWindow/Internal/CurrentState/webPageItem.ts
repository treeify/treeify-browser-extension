import {List} from 'immutable'
import {ItemId, ItemType} from 'src/TreeifyWindow/basicType'
import {CurrentState} from 'src/TreeifyWindow/Internal/CurrentState/index'
import {Internal} from 'src/TreeifyWindow/Internal/Internal'
import {PropertyPath} from 'src/TreeifyWindow/Internal/PropertyPath'
import {State} from 'src/TreeifyWindow/Internal/State'
import {Timestamp} from 'src/TreeifyWindow/Timestamp'
import {get, writable} from 'svelte/store'

/**
 * 新しい空のウェブページアイテムを作成し、CurrentStateに登録する。
 * ただしアイテムの配置（親子関係の設定）は行わない。
 */
export function createWebPageItem(): ItemId {
  const newItemId = CurrentState.obtainNewItemId()

  const newItem: State.Item = {
    itemType: ItemType.WEB_PAGE,
    childItemIds: writable(List.of()),
    parents: {},
    timestamp: writable(Timestamp.now()),
    cssClasses: writable(List.of()),
  }
  Internal.instance.state.items[newItemId] = newItem
  Internal.instance.markAsMutated(PropertyPath.of('items', newItemId))

  const webPageItem: State.WebPageItem = {
    url: writable(''),
    faviconUrl: writable(''),
    tabTitle: writable(''),
    title: writable(null),
    isUnread: writable(false),
  }
  Internal.instance.state.webPageItems[newItemId] = webPageItem
  Internal.instance.markAsMutated(PropertyPath.of('webPageItems', newItemId))

  return newItemId
}

/** StateのwebPageItemsオブジェクトから指定されたアイテムIDのエントリーを削除する */
export function deleteWebPageItemEntry(itemId: ItemId) {
  delete Internal.instance.state.webPageItems[itemId]
  Internal.instance.markAsMutated(PropertyPath.of('webPageItems', itemId))
}

/** ウェブページアイテムのタブタイトルを設定する */
export function setWebPageItemTabTitle(itemId: ItemId, tabTitle: string) {
  Internal.instance.state.webPageItems[itemId].tabTitle.set(tabTitle)
  Internal.instance.markAsMutated(PropertyPath.of('webPageItems', itemId, 'tabTitle'))
}

/** ウェブページアイテムのタイトルを設定する */
export function setWebPageItemTitle(itemId: ItemId, title: string | null) {
  Internal.instance.state.webPageItems[itemId].title.set(title)
  Internal.instance.markAsMutated(PropertyPath.of('webPageItems', itemId, 'title'))
}

/** ウェブページアイテムのURLを設定する */
export function setWebPageItemUrl(itemId: ItemId, url: string) {
  Internal.instance.state.webPageItems[itemId].url.set(url)
  Internal.instance.markAsMutated(PropertyPath.of('webPageItems', itemId, 'url'))
}

/** ウェブページアイテムのファビコンURLを設定する */
export function setWebPageItemFaviconUrl(itemId: ItemId, url: string) {
  Internal.instance.state.webPageItems[itemId].faviconUrl.set(url)
  Internal.instance.markAsMutated(PropertyPath.of('webPageItems', itemId, 'faviconUrl'))
}

export function deriveWebPageItemTitle(itemId: ItemId): string {
  const webPageItem = Internal.instance.state.webPageItems[itemId]
  const title = get(webPageItem.title) ?? get(webPageItem.tabTitle)
  return title !== '' ? title : get(webPageItem.url)
}

/** ウェブページアイテムの未読フラグを上書き設定する */
export function setIsUnreadFlag(itemId: ItemId, isUnread: boolean) {
  Internal.instance.state.webPageItems[itemId].isUnread.set(isUnread)
  Internal.instance.markAsMutated(PropertyPath.of('webPageItems', itemId, 'isUnread'))
}
