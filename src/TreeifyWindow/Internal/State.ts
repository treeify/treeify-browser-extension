import {List} from 'immutable'
import {ItemId, ItemType, WorkspaceId} from 'src/TreeifyWindow/basicType'
import {Command} from 'src/TreeifyWindow/Internal/Command'
import {DomishObject} from 'src/TreeifyWindow/Internal/DomishObject'
import {InputId} from 'src/TreeifyWindow/Internal/InputId'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {Timestamp} from 'src/TreeifyWindow/Timestamp'
import {Writable} from 'svelte/store'

/** Treeifyの状態全体を表すオブジェクトの型 */
export type State = {
  items: {[K in ItemId]: State.Item}
  textItems: {[K in ItemId]: State.TextItem}
  webPageItems: {[K in ItemId]: State.WebPageItem}
  imageItems: {[K in ItemId]: State.ImageItem}
  codeBlockItems: {[K in ItemId]: State.CodeBlockItem}
  pages: {[K in ItemId]: State.Page}
  workspaces: {[K in WorkspaceId]: State.Workspace}
  /**
   * マウントされているページたちのアイテムID。
   * 並び順はアクティブ化された順（アクティブページが末尾）
   */
  mountedPageIds: Writable<List<ItemId>>
  /** 削除され再利用されるアイテムID群 */
  availableItemIds: List<ItemId>
  maxItemId: ItemId
  /** アイテムツリー領域におけるキーボード入力とコマンドの対応付け */
  itemTreeKeyboardBinding: {[K in InputId]: List<Command>}
  /** アイテムツリーの削除ボタンのマウス入力とコマンドの対応付け */
  itemTreeDeleteButtonMouseBinding: {[K in InputId]: List<Command>}
  /** 各ダイアログの状態 */
  webPageItemTitleSettingDialog: Writable<State.WebPageItemTitleSettingDialog | null>
  codeBlockItemEditDialog: State.CodeBlockItemEditDialog | null
  defaultWindowModeSettingDialog: State.DefaultWindowModeSettingDialog | null
  workspaceDialog: State.WorkspaceDialog | null
  labelEditDialog: Writable<State.LabelEditDialog | null>
  otherParentsDialog: State.OtherParentsDialog | null
}

export namespace State {
  /**
   * 全てのアイテムが共通で持つデータの型。
   * つまり、ItemTypeによらず各アイテムが必ず持っているデータ。
   */
  export type Item = {
    itemType: ItemType
    childItemIds: Writable<List<ItemId>>
    parents: {[K in ItemId]: Edge}
    /** 足跡表示機能で使われるタイムスタンプ */
    timestamp: Writable<Timestamp>
    /**
     * このアイテムにアドホックに付与されるCSSクラスのリスト。
     * 付与されたアイテム本体とその子孫に別々のスタイルを適用できるよう、
     * 子孫側には末尾に"-children"を追加したCSSクラスを付与する。
     */
    cssClasses: Writable<List<string>>
  }

  export type Edge = {
    /**
     * 折りたたみ状態か展開状態かのフラグ。
     *
     * 【ItemではなくEdgeで持つ理由】
     * トランスクルードされたアイテムのisCollapsedを変更しても、他の視座に影響を与えずに済む。
     * アクティブページを表示する際に、そのページがisCollapsedかどうかを気にせず済む。
     * 正直、具体的なメリットはこれくらいしか思いつかない。
     * リスクはあるが直感的に面白そうなこちらに賭けてみた。
     */
    isCollapsed: boolean

    /**
     * いわゆる意味ネットワークのように、エッジが持つラベルのデータ。
     * List型なので複数設定できる。List内の並び順がそのまま画面表示上の並び順として使われる。
     */
    labels: List<string>
  }
  export function createDefaultEdge(): Edge {
    return {isCollapsed: false, labels: List.of()}
  }

  /** テキストアイテムが固有で持つデータの型 */
  export type TextItem = {
    domishObjects: Writable<List<DomishObject>>
  }

  /** ウェブページアイテムが固有で持つデータの型 */
  export type WebPageItem = {
    url: Writable<string>
    /**
     * ファビコンのURL。
     * 指定なしの場合は空文字列。
     * アンロード後もファビコンを表示するために、このオブジェクトで保持する。
     */
    faviconUrl: Writable<string>
    /**
     * タブのタイトル。
     * アンロード後もタイトルを表示するために、このオブジェクトで保持する。
     */
    tabTitle: Writable<string>
    /**
     * タブのタイトルを上書き表示するためのタイトル。
     * nullの場合はtabTitleがこのウェブページアイテムのタイトルとして扱われる。
     */
    title: Writable<string | null>
    /** 未読フラグ */
    isUnread: Writable<boolean>
  }

  /** 画像アイテムが固有で持つデータの型 */
  export type ImageItem = {
    url: Writable<string>
    caption: Writable<string>
  }

  /** コードブロックアイテムが固有で持つデータの型 */
  export type CodeBlockItem = {
    code: Writable<string>
    language: Writable<string>
  }

  /** 各ページが持つデータの型 */
  export type Page = {
    /** アイテムツリー内で操作対象となるアイテム */
    targetItemPath: ItemPath
    /**
     * アイテム複数選択時の範囲の一端。
     * テキスト選択におけるanchorと同じ意味合い。
     */
    anchorItemPath: ItemPath
    /** このページのデフォルトのウィンドウモード */
    defaultWindowMode: DefaultWindowMode
  }

  export type Workspace = {
    /**
     * このワークスペースでページツリーや検索結果から除外したいアイテム群。
     * これに含まれるアイテムまたはその子孫アイテムはページツリーや検索結果から除外される。
     */
    excludedItemIds: List<ItemId>
    name: string
  }

  /**
   * 'keep'の場合、ウィンドウモードの自動変更は行わない。
   * 'inherit'の場合、親ページのデフォルトウィンドウモードを再帰的に参照する。
   */
  export type DefaultWindowMode = 'dual' | 'full' | 'floating' | 'keep' | 'inherit'

  /** ウェブページアイテムのタイトル設定ダイアログが固有で持つ状態の型 */
  export type WebPageItemTitleSettingDialog = {
    /** 対象となるアイテムのDOM要素のgetBoundingClientRect()の結果 */
    targetItemRect: DOMRect
  }

  /** コードブロックアイテム編集ダイアログが持つ内部状態の型 */
  export type CodeBlockItemEditDialog = {
    code: string
    language: string
  }

  /** デフォルトウィンドウモード設定ダイアログが持つ内部状態の型 */
  export type DefaultWindowModeSettingDialog = {}

  export type WorkspaceDialog = {}

  /** ラベル編集ダイアログが持つ内部状態の型 */
  export type LabelEditDialog = {}

  export type OtherParentsDialog = {}

  /** Stateに対してJSON.stringifyする際に用いるreplacer */
  export function jsonReplacer(this: any, key: string, value: any): any {
    if (value instanceof List) {
      return (value as List<unknown>).toArray()
    }
    return value
  }

  /** Stateに対してJSON.parseする際に用いるreplacer */
  export function jsonReviver(key: any, value: any) {
    if (value instanceof Array) {
      return List(value as Array<unknown>)
    }
    return value
  }
}
