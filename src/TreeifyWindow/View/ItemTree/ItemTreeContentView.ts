import {TemplateResult} from 'lit-html'
import {assertNeverType} from 'src/Common/Debug/assert'
import {ItemType} from 'src/TreeifyWindow/basicType'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {State} from 'src/TreeifyWindow/Internal/State'
import {
  createItemTreeCodeBlockContentViewModel,
  ItemTreeCodeBlockContentView,
  ItemTreeCodeBlockContentViewModel,
} from 'src/TreeifyWindow/View/ItemTree/ItemTreeCodeBlockContentView'
import {
  createItemTreeImageContentViewModel,
  ItemTreeImageContentView,
  ItemTreeImageContentViewModel,
} from 'src/TreeifyWindow/View/ItemTree/ItemTreeImageContentView'
import {
  createItemTreeWebPageContentViewModel,
  ItemTreeWebPageContentView,
  ItemTreeWebPageContentViewModel,
} from 'src/TreeifyWindow/View/ItemTree/ItemTreeWebPageContentView'
import {
  createItemTreeTextContentViewModel,
  ItemTreeTextContentView,
  ItemTreeTextContentViewModel,
} from './ItemTreeTextContentView'

export type ItemTreeContentViewModel =
  | ItemTreeTextContentViewModel
  | ItemTreeWebPageContentViewModel
  | ItemTreeImageContentViewModel
  | ItemTreeCodeBlockContentViewModel

export function createItemTreeContentViewModel(
  state: State,
  itemPath: ItemPath,
  itemType: ItemType
): ItemTreeContentViewModel {
  // アイテムタイプごとの固有部分を追加して返す
  switch (itemType) {
    case ItemType.TEXT:
      return createItemTreeTextContentViewModel(state, itemPath)
    case ItemType.WEB_PAGE:
      return createItemTreeWebPageContentViewModel(state, itemPath)
    case ItemType.IMAGE:
      return createItemTreeImageContentViewModel(state, itemPath)
    case ItemType.CODE_BLOCK:
      return createItemTreeCodeBlockContentViewModel(state, itemPath)
    default:
      assertNeverType(itemType)
  }
}

/** アイテムツリーの各アイテムのコンテンツ領域のViewスイッチャー */
export function ItemTreeContentView(viewModel: ItemTreeContentViewModel): TemplateResult {
  switch (viewModel.itemType) {
    case ItemType.TEXT:
      return ItemTreeTextContentView(viewModel)
    case ItemType.WEB_PAGE:
      return ItemTreeWebPageContentView(viewModel)
    case ItemType.IMAGE:
      return ItemTreeImageContentView(viewModel)
    case ItemType.CODE_BLOCK:
      return ItemTreeCodeBlockContentView(viewModel)
    default:
      assertNeverType(viewModel)
  }
}

export namespace ItemTreeContentView {
  /** DOM描画後にフォーカスを設定するために用いる */
  export function focusableDomElementId(itemPath: ItemPath): string {
    return `focusable:${JSON.stringify(itemPath)}`
  }
}
