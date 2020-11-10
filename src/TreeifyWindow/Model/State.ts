import {List} from 'immutable'
import {integer, ItemId, ItemType, StableTabId} from 'src/Common/basicType'
import {DomishObject} from 'src/Common/DomishObject'
import {Timestamp} from 'src/Common/Timestamp'
import {Command} from 'src/TreeifyWindow/Model/Command'
import {ItemPath} from 'src/TreeifyWindow/Model/ItemPath'

/** Treeifyの状態全体を表すオブジェクトの型 */
export type State = {
  /** キーの型はItemIdと書きたいが、TypeScriptの仕様上numberとしか書けない */
  items: {[index: number]: Item}
  textItems: {[index: number]: TextItem}
  webPageItems: {[index: number]: WebPageItem}
  pages: {[index: number]: Page}
  nextNewItemId: ItemId
  activePageId: ItemId
  focusedItemPath: ItemPath | null
  itemTreeTextItemSelection: TextItemSelection | null
  /**
   * キーボードやマウスでの入力とコマンドの対応付け。
   * キーの型はInputIdと書きたいが、TypeScriptの仕様上stringとしか書けない。
   */
  itemTreeInputBinding: {[inputId: string]: Command}
}

/**
 * 全てのアイテムが共通で持つデータの型。
 * つまり、ItemTypeによらず各アイテムが必ず持っているデータ。
 */
export type Item = {
  itemId: ItemId
  itemType: ItemType
  childItemIds: List<ItemId>
  parentItemIds: List<ItemId>
  isFolded: boolean
  /** 足跡表示機能で使われるタイムスタンプ */
  timestamp: Timestamp
}

/** テキストアイテムが固有で持つデータの型 */
export type TextItem = {
  itemId: ItemId
  domishObjects: List<DomishObject>
}

/** ウェブページアイテムが固有で持つデータの型 */
export type WebPageItem = {
  itemId: ItemId
  /**
   * このアイテムと対応するタブのID。
   * 対応するタブがない場合はnull。
   */
  stableTabId: StableTabId | null
  url: string
  /**
   * ファビコンのURL。
   * 指定なしの場合は空文字列。
   * タブを閉じた後もファビコンを表示するために、このオブジェクトで保持する。
   */
  faviconUrl: string
  /**
   * タブのタイトル。
   * タブを閉じた後もタイトルを表示するために、このオブジェクトで保持する。
   */
  tabTitle: string
  /**
   * 正規表現によるタイトル置換の入力パターン。
   * 例えば"(.*)"や""などが入る。
   */
  titleReplaceInputPattern: string
  /**
   * 正規表現によるタイトル置換の出力パターン。
   * 例えば"$1"や""などが入る。
   */
  titleReplaceOutputPattern: string
}

/** 各ページが持つデータの型 */
export type Page = {}

/** テキストアイテムのcontenteditableにおけるキャレット位置 */
export type TextItemSelection = {
  focusOffset: integer
  anchorOffset: integer
}
