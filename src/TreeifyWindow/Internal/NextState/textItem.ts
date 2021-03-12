import {List} from 'immutable'
import {ItemId, ItemType} from 'src/Common/basicType'
import {DomishObject} from 'src/Common/DomishObject'
import {Timestamp} from 'src/Common/Timestamp'
import {PropertyPath} from 'src/TreeifyWindow/Internal/Batchizer'
import {NextState} from 'src/TreeifyWindow/Internal/NextState/index'
import {Item, TextItem} from 'src/TreeifyWindow/Internal/State'

/** 指定されたテキストアイテムのdomishObjectsを返す */
export function getTextItemDomishObjects(itemId: ItemId): List<DomishObject> {
  return NextState.getBatchizer().getDerivedValue(
    PropertyPath.of('textItems', itemId, 'domishObjects')
  )
}

/** 指定されたテキストアイテムのdomishObjectsを更新する */
export function setTextItemDomishObjects(textItemId: ItemId, domishObjects: List<DomishObject>) {
  NextState.getBatchizer().postSetMutation(
    PropertyPath.of('textItems', textItemId, 'domishObjects'),
    domishObjects
  )
}

/**
 * 新しい空のテキストアイテムを作成し、NextStateに登録する。
 * ただしアイテムの配置（親子関係の設定）は行わない。
 */
export function createTextItem(): ItemId {
  const newItemId = NextState.getNextNewItemId()

  const newItem: Item = {
    itemId: newItemId,
    itemType: ItemType.TEXT,
    childItemIds: List.of(),
    parentItemIds: List.of(),
    isFolded: false,
    timestamp: Timestamp.now(),
    cssClasses: List.of(),
  }
  NextState.getBatchizer().postSetMutation(PropertyPath.of('items', newItemId), newItem)

  const newTextItem: TextItem = {
    itemId: newItemId,
    domishObjects: List.of(),
  }
  NextState.getBatchizer().postSetMutation(PropertyPath.of('textItems', newItemId), newTextItem)

  NextState.setNextNewItemId(newItemId + 1)

  return newItemId
}