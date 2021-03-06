import {assertNeverType} from 'src/Common/Debug/assert'
import {integer} from 'src/Common/integer'
import {ItemType} from 'src/TreeifyTab/basicType'
import {CurrentState} from 'src/TreeifyTab/Internal/CurrentState'
import {DomishObject} from 'src/TreeifyTab/Internal/DomishObject'
import {Internal} from 'src/TreeifyTab/Internal/Internal'
import {ItemPath} from 'src/TreeifyTab/Internal/ItemPath'

export function toMarkdownText(itemPath: ItemPath, level: integer = 1): string {
  // TODO: 循環参照があると無限ループになる
  const childItemIds = Internal.instance.state.items[ItemPath.getItemId(itemPath)].childItemIds
  if (childItemIds.isEmpty()) {
    return toMultiLineMarkdownContent(itemPath) + '  \n'
  } else {
    const headline = `${'#'.repeat(level)} ${toSingleLineMarkdownContent(itemPath)}\n`
    const childrenContents = childItemIds.map((childItemId) => {
      return toMarkdownText(itemPath.push(childItemId), level + 1)
    })
    // 子リストの末尾に空行を付けて段落化させている。
    // 理由は次のような状況でBとCの切れ目を作るため。
    // A
    //   B
    // C
    // ↓ Markdown化
    // # A
    // B
    // （ここに空行を入れて段落化しないと境界線が全く分からなくなる）
    // C
    return headline + childrenContents.join('') + '\n'
  }
}

function toMultiLineMarkdownContent(itemPath: ItemPath): string {
  const itemId = ItemPath.getItemId(itemPath)
  const item = Internal.instance.state.items[itemId]
  // Markdownの引用記法のための接頭辞と接尾辞
  const prefix = item.cite !== null ? '> ' : ''
  const postfix = item.cite !== null ? '\n' : ''

  switch (item.itemType) {
    case ItemType.TEXT:
      const domishObjects = Internal.instance.state.textItems[itemId].domishObjects
      return prefix + DomishObject.toMultiLineMarkdownText(domishObjects) + postfix
    case ItemType.WEB_PAGE:
      const webPageItem = Internal.instance.state.webPageItems[itemId]
      const title = CurrentState.deriveWebPageItemTitle(itemId) + postfix
      return prefix + `[${title}](${webPageItem.url})  `
    case ItemType.IMAGE:
      const imageItem = Internal.instance.state.imageItems[itemId]
      return prefix + `![${imageItem.caption}](${imageItem.url} "${imageItem.caption}")  ` + postfix
    case ItemType.CODE_BLOCK:
      const codeBlockItem = Internal.instance.state.codeBlockItems[itemId]
      // 軽く確認したところコードブロックと引用は両立できないようなので無視する
      return '```' + codeBlockItem.language + '\n' + codeBlockItem.code + '\n```'
    case ItemType.TEX:
      const texItem = Internal.instance.state.texItems[itemId]
      return prefix + `$$ ${texItem.code} $$` + postfix
    default:
      assertNeverType(item.itemType)
  }
}

function toSingleLineMarkdownContent(itemPath: ItemPath): string {
  const itemId = ItemPath.getItemId(itemPath)
  const itemType = Internal.instance.state.items[itemId].itemType
  switch (itemType) {
    case ItemType.TEXT:
      const domishObjects = Internal.instance.state.textItems[itemId].domishObjects
      return DomishObject.toSingleLineMarkdownText(domishObjects)
    case ItemType.WEB_PAGE:
      const webPageItem = Internal.instance.state.webPageItems[itemId]
      const title = CurrentState.deriveWebPageItemTitle(itemId)
      return `[${title}](${webPageItem.url})  `
    case ItemType.IMAGE:
      const imageItem = Internal.instance.state.imageItems[itemId]
      return `![${imageItem.caption}](${imageItem.url} "${imageItem.caption}")  `
    case ItemType.CODE_BLOCK:
      const codeBlockItem = Internal.instance.state.codeBlockItems[itemId]
      return '`' + codeBlockItem.code.replaceAll(/\r?\n/g, ' ') + '`'
    case ItemType.TEX:
      const texItem = Internal.instance.state.texItems[itemId]
      return `$$ ${texItem.code.replaceAll(/\r?\n/g, ' ')} $$`
    default:
      assertNeverType(itemType)
  }
}
