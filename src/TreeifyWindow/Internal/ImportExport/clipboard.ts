import {List} from 'immutable'
import {doWithErrorCapture} from 'src/TreeifyWindow/errorCapture'
import {getTextItemSelectionFromDom} from 'src/TreeifyWindow/External/domTextSelection'
import {External} from 'src/TreeifyWindow/External/External'
import {CurrentState} from 'src/TreeifyWindow/Internal/CurrentState'
import {
  exportAsIndentedText,
  pasteMultilineText,
} from 'src/TreeifyWindow/Internal/ImportExport/indentedText'
import {
  createItemsBasedOnOpml,
  toOpmlString,
  tryParseAsOpml,
} from 'src/TreeifyWindow/Internal/ImportExport/opml'
import {Internal} from 'src/TreeifyWindow/Internal/Internal'
import {ItemPath} from 'src/TreeifyWindow/Internal/ItemPath'
import {NullaryCommand} from 'src/TreeifyWindow/Internal/NullaryCommand'
import {Edge} from 'src/TreeifyWindow/Internal/State'
import {Rerenderer} from 'src/TreeifyWindow/Rerenderer'

export function onCopy(event: ClipboardEvent) {
  doWithErrorCapture(() => {
    if (event.clipboardData === null) return

    External.instance.treeifyClipboard = undefined

    const textSelection = getTextItemSelectionFromDom()
    if (textSelection?.focusDistance !== textSelection?.anchorDistance) {
      // テキストが範囲選択されていればブラウザのデフォルトの動作に任せる
    } else {
      // テキストが範囲選択されていなければターゲットアイテムのコピーを行う
      event.preventDefault()

      // インデント形式のテキストをクリップボードに入れる
      const contentText = CurrentState.getSelectedItemPaths().map(exportAsIndentedText).join('\n')
      event.clipboardData.setData('text/plain', contentText)

      // OPML形式のテキストをクリップボードに入れる
      event.clipboardData.setData(
        'application/xml',
        toOpmlString(CurrentState.getSelectedItemPaths())
      )
    }
  })
}

export function onCut(event: ClipboardEvent) {
  doWithErrorCapture(() => {
    if (event.clipboardData === null) return

    Internal.instance.saveCurrentStateToUndoStack()

    External.instance.treeifyClipboard = undefined

    const textSelection = getTextItemSelectionFromDom()
    if (textSelection?.focusDistance !== textSelection?.anchorDistance) {
      // テキストが範囲選択されていればブラウザのデフォルトの動作に任せる
    } else {
      // テキストが範囲選択されていなければターゲットアイテムのコピーを行う
      event.preventDefault()

      // インデント形式のテキストをクリップボードに入れる
      const contentText = CurrentState.getSelectedItemPaths().map(exportAsIndentedText).join('\n')
      event.clipboardData.setData('text/plain', contentText)

      // OPML形式のテキストをクリップボードに入れる
      event.clipboardData.setData(
        'application/xml',
        toOpmlString(CurrentState.getSelectedItemPaths())
      )

      NullaryCommand.deleteItem()
      Rerenderer.instance.rerender()
    }
  })
}

// ペースト時にプレーンテキスト化する
export function onPaste(event: ClipboardEvent) {
  doWithErrorCapture(() => {
    if (event.clipboardData === null) return

    Internal.instance.saveCurrentStateToUndoStack()

    event.preventDefault()
    const targetItemPath = CurrentState.getTargetItemPath()

    const text = event.clipboardData.getData('text/plain')

    // 独自クリップボードを優先して貼り付ける
    if (External.instance.treeifyClipboard !== undefined) {
      // 独自クリップボードへのコピー後に他アプリ上で何かをコピーされた場合のガード
      if (text === External.instance.getTreeifyClipboardHash()) {
        // TODO: 兄弟リスト内に同一アイテムが複数含まれてしまう場合のエラー処理を追加する

        // TODO: selectedItemPathsは削除や移動されたアイテムを指している可能性がある
        for (const selectedItemPath of External.instance.treeifyClipboard.selectedItemPaths.reverse()) {
          const selectedItemId = ItemPath.getItemId(selectedItemPath)
          // 循環参照発生時を考慮して、トランスクルード時は必ずcollapsedとする
          const initialEdge: Edge = {isCollapsed: true, labels: List.of()}
          CurrentState.insertBelowItem(targetItemPath, selectedItemId, initialEdge)
        }

        Rerenderer.instance.rerender()
        return
      } else {
        External.instance.treeifyClipboard = undefined
      }
    }

    const opmlParseResult = tryParseAsOpml(getOpmlMimeTypeText(event.clipboardData))
    // OPML形式の場合
    if (opmlParseResult !== undefined) {
      for (const itemAndEdge of createItemsBasedOnOpml(opmlParseResult).reverse()) {
        CurrentState.insertBelowItem(targetItemPath, itemAndEdge.itemId, itemAndEdge.edge)
      }
      Rerenderer.instance.rerender()
      return
    }

    if (!text.includes('\n')) {
      // 1行だけのテキストの場合

      // GyazoのスクリーンショットのURLを判定する。
      // 'https://gyazo.com/'に続けてMD5の32文字が来る形式になっている模様。
      const gyazoUrlPattern = /https:\/\/gyazo\.com\/\w{32}/
      if (gyazoUrlPattern.test(text)) {
        // GyazoのスクリーンショットのURLなら画像アイテムを作る
        const newItemId = CurrentState.createImageItem()
        // TODO: Gyazoの画像はpngとは限らない
        CurrentState.setImageItemUrl(newItemId, text + '.png')
        CurrentState.insertBelowItem(targetItemPath, newItemId)
        Rerenderer.instance.rerender()
      } else {
        document.execCommand('insertText', false, text)
      }
    } else {
      // 複数行にわたるテキストの場合
      pasteMultilineText(text)
    }
  })
}

// OPMLの可能性があるMIMEタイプをいろいろ試してテキストを取り出す
function getOpmlMimeTypeText(dataTransfer: DataTransfer): string {
  const textXOpml = dataTransfer.getData('text/x-opml')
  if (textXOpml !== '') return textXOpml

  const applicationXml = dataTransfer.getData('application/xml')
  if (applicationXml !== '') return applicationXml

  const textXml = dataTransfer.getData('text/xml')
  if (textXml !== '') return textXml

  return dataTransfer.getData('text/plain')
}

/**
 * 与えられたテキストに含まれるURLを返す。
 * URLが見つからなかった場合はundefinedを返す。
 * 複数のURLが含まれる場合、最初に出てきたものを返す。
 * ChromeのタブのURLとして使われる可能性があるので、about:blank と chrome://* はURL扱いする。
 *
 * なおURLには仕様上()や[]が含まれていても許される。
 * そのためMarkdownやScrapboxのリンク記法をこの関数では正しく扱えないので注意。
 */
export function detectUrl(text: string): string | undefined {
  if (text.includes('about:blank')) {
    return 'about:blank'
  }

  const result = text.match(
    /(https?|file|chrome):\/\/[\w.,/:;'()\[\]%$&@#?!=+*~\-_\p{scx=Hiragana}\p{scx=Katakana}\p{sc=Han}}]+/u
  )
  if (result !== null) {
    return result[0]
  }

  return undefined
}
