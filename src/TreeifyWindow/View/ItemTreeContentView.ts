import {TemplateResult} from 'lit-html'
import {assertNeverType} from 'src/Common/Debug/assert'
import {ItemType} from 'src/Common/typeAlias'
import {ItemTreeTextContentView, ItemTreeTextContentViewModel} from './ItemTreeTextContentView'

export type ItemTreeContentViewModel = ItemTreeTextContentViewModel

/** アイテムツリーの各アイテムのコンテンツ領域のViewスイッチャー */
export function ItemTreeContentView(viewModel: ItemTreeContentViewModel): TemplateResult {
  switch (viewModel.itemType) {
    case ItemType.TEXT:
      return ItemTreeTextContentView(viewModel)
    default:
      assertNeverType(viewModel.itemType)
  }
}
