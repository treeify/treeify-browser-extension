import {
  becomeAndShowPage,
  deleteItem,
  enterKeyDefault,
  indentItem,
  insertLineBreak,
  moveItemDownward,
  moveItemUpward,
  showPage,
  toggleFolded,
  toggleGrayedOut,
  togglePaged,
  unindentItem,
} from 'src/TreeifyWindow/Model/NullaryCommand/item'
import {unloadItem, unloadSubtree} from 'src/TreeifyWindow/Model/NullaryCommand/webPageItem'
import {openDatabaseFileDialog} from 'src/TreeifyWindow/Model/NullaryCommand/other'

export * from 'src/TreeifyWindow/Model/NullaryCommand/item'
export * from 'src/TreeifyWindow/Model/NullaryCommand/webPageItem'
export * from 'src/TreeifyWindow/Model/NullaryCommand/other'

/**
 * この名前空間で定義される全てのコマンド関数をまとめたオブジェクト。
 * 動的にコマンド名からコマンド関数を得るために用いる。
 */
export const functions: {[name: string]: () => void} = {
  toggleFolded,
  indentItem,
  unindentItem,
  moveItemUpward,
  moveItemDownward,
  enterKeyDefault,
  deleteItem,
  insertLineBreak,
  togglePaged,
  showPage,
  becomeAndShowPage,
  toggleGrayedOut,
  unloadItem,
  unloadSubtree,
  openDatabaseFileDialog,
}
