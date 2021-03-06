import {List} from 'immutable'
import {assertNonNull, assertNonUndefined} from 'src/Common/Debug/assert'
import {integer} from 'src/Common/integer'
import {ItemId, ItemType} from 'src/TreeifyTab/basicType'
import {doWithErrorCapture} from 'src/TreeifyTab/errorCapture'
import {matchTabsAndWebPageItems} from 'src/TreeifyTab/External/chromeEventListeners'
import {
  focusMainAreaBackground,
  getTextItemSelectionFromDom,
  setDomSelection,
} from 'src/TreeifyTab/External/domTextSelection'
import {External} from 'src/TreeifyTab/External/External'
import {Command} from 'src/TreeifyTab/Internal/Command'
import {CurrentState} from 'src/TreeifyTab/Internal/CurrentState'
import {DomishObject} from 'src/TreeifyTab/Internal/DomishObject'
import {InputId} from 'src/TreeifyTab/Internal/InputId'
import {Internal} from 'src/TreeifyTab/Internal/Internal'
import {ItemPath} from 'src/TreeifyTab/Internal/ItemPath'
import {NullaryCommand} from 'src/TreeifyTab/Internal/NullaryCommand'
import {PropertyPath} from 'src/TreeifyTab/Internal/PropertyPath'
import {State} from 'src/TreeifyTab/Internal/State'
import {Rerenderer} from 'src/TreeifyTab/Rerenderer'
import {MainAreaContentView} from 'src/TreeifyTab/View/MainArea/MainAreaContentProps'
import {
  createMainAreaNodeProps,
  MainAreaNodeProps,
} from 'src/TreeifyTab/View/MainArea/MainAreaNodeProps'

export type MainAreaProps = {
  rootNodeProps: MainAreaNodeProps
  onKeyDown: (event: KeyboardEvent) => void
  onDragImageBottom: (event: MouseEvent, itemId: ItemId, imageRectTop: integer) => void
}

export function createMainAreaProps(state: State): MainAreaProps {
  const rootItemPath = List.of(CurrentState.getActivePageId())

  const allDisplayingItemIds = [...CurrentState.getAllDisplayingItemIds(state, rootItemPath)]
  // 足跡表示数を計算
  // TODO: パラメータをカスタマイズ可能にする。なおこれをCSS変数にしていいのかどうかは微妙な問題
  const footprintCount = Math.floor(allDisplayingItemIds.length ** 0.5)

  // TODO: 同時に複数のアイテムが操作された場合でも足跡をきちんと表示できるように修正する
  const sorted = allDisplayingItemIds.sort((a: ItemId, b: ItemId) => {
    return state.items[b].timestamp - state.items[a].timestamp
  })

  // 各アイテムに足跡順位を対応付け
  const footprintRankMap = new Map<ItemId, integer>()
  for (let i = 0; i < footprintCount; i++) {
    footprintRankMap.set(sorted[i], i)
  }

  return {
    rootNodeProps: createMainAreaNodeProps(state, footprintRankMap, footprintCount, rootItemPath),
    onKeyDown,
    onDragImageBottom,
  }
}

function onKeyDown(event: KeyboardEvent) {
  doWithErrorCapture(() => {
    // IME入力中やIME確定時（特にEnterキー）はTreeifyの処理が暴発しないようにする。
    // 参考：https://qiita.com/ledsun/items/31e43a97413dd3c8e38e
    if (event.isComposing) return

    const inputId = InputId.fromKeyboardEvent(event)
    switch (inputId) {
      case '0000ArrowLeft':
        onArrowLeft(event)
        return
      case '0000ArrowRight':
        onArrowRight(event)
        return
      case '0000ArrowUp':
        onArrowUp(event)
        return
      case '0000ArrowDown':
        onArrowDown(event)
        return
      case '0100ArrowUp':
        onShiftArrowUp(event)
        return
      case '0100ArrowDown':
        onShiftArrowDown(event)
        return
      case '0000Backspace':
        onBackspace(event)
        return
      case '0000Delete':
        onDelete(event)
        return
      case '0000Space':
        onSpace(event)
        return
      case '1000KeyZ':
        event.preventDefault()
        undo()
        return
    }

    const commands: List<Command> | undefined =
      Internal.instance.state.mainAreaKeyboardBinding[inputId]
    if (commands !== undefined) {
      event.preventDefault()

      Internal.instance.saveCurrentStateToUndoStack()

      for (const command of commands) {
        Command.execute(command)
      }
      Rerenderer.instance.rerender()
    }
  })
}

/**
 * ←キー押下時の処理。
 * キャレット位置によってブラウザの挙動に任せるかどうか分岐する。
 */
function onArrowLeft(event: KeyboardEvent) {
  const targetItemPath = CurrentState.getTargetItemPath()

  const aboveItemPath = CurrentState.findAboveItemPath(targetItemPath)
  // 上のアイテムが存在しない場合はブラウザの挙動に任せる
  if (aboveItemPath === undefined) return

  const aboveItemId = ItemPath.getItemId(aboveItemPath)

  const textItemSelection = getTextItemSelectionFromDom()
  if (textItemSelection === undefined) {
    event.preventDefault()
    CurrentState.setTargetItemPath(aboveItemPath)

    const aboveItemType = Internal.instance.state.items[aboveItemId].itemType
    if (aboveItemType === ItemType.TEXT) {
      // 上のアイテムがテキストアイテムの場合、キャレットをその末尾に移動する
      const domishObjects = Internal.instance.state.textItems[aboveItemId].domishObjects
      const characterCount = DomishObject.countCharacters(domishObjects)
      Rerenderer.instance.requestSetCaretDistanceAfterRendering(characterCount)
    }

    Rerenderer.instance.rerender()
  } else {
    // キャレット位置が先頭以外のときはブラウザの挙動に任せる
    if (textItemSelection.focusDistance > 0 || textItemSelection.anchorDistance > 0) {
      return
    }

    event.preventDefault()
    CurrentState.setTargetItemPath(aboveItemPath)

    const aboveItemType = Internal.instance.state.items[aboveItemId].itemType
    if (aboveItemType === ItemType.TEXT) {
      // 上のアイテムがテキストアイテムの場合、キャレットをその末尾に移動する
      const domishObjects = Internal.instance.state.textItems[aboveItemId].domishObjects
      const characterCount = DomishObject.countCharacters(domishObjects)
      Rerenderer.instance.requestSetCaretDistanceAfterRendering(characterCount)
    }

    Rerenderer.instance.rerender()
  }
}

/**
 * →キー押下時の処理。
 * キャレット位置によってブラウザの挙動に任せるかどうか分岐する。
 */
function onArrowRight(event: KeyboardEvent) {
  const targetItemPath = CurrentState.getTargetItemPath()
  const belowItemPath = CurrentState.findBelowItemPath(targetItemPath)
  // 下のアイテムが存在しない場合はブラウザの挙動に任せる
  if (belowItemPath === undefined) return

  const belowItemId = ItemPath.getItemId(belowItemPath)

  const textItemSelection = getTextItemSelectionFromDom()
  if (textItemSelection === undefined) {
    event.preventDefault()
    CurrentState.setTargetItemPath(belowItemPath)
    Rerenderer.instance.rerender()
  } else {
    const targetItemId = ItemPath.getItemId(targetItemPath)
    const domishObjects = Internal.instance.state.textItems[targetItemId].domishObjects
    const characterCount = DomishObject.countCharacters(domishObjects)

    // キャレット位置が末尾以外のときはブラウザの挙動に任せる
    if (
      textItemSelection.focusDistance < characterCount ||
      textItemSelection.anchorDistance < characterCount
    ) {
      return
    }

    const belowItemType = Internal.instance.state.items[belowItemId].itemType
    if (belowItemType === ItemType.TEXT) {
      // 下のアイテムがテキストアイテムの場合、キャレットをその先頭に移動する
      event.preventDefault()
      CurrentState.setTargetItemPath(belowItemPath)
      Rerenderer.instance.rerender()
    } else {
      // 下のアイテムがテキストアイテム以外の場合、それをフォーカスする
      event.preventDefault()
      CurrentState.setTargetItemPath(belowItemPath)
      Rerenderer.instance.rerender()
    }
  }
}

/**
 * ↑キー押下時の処理。
 * キャレット位置によってブラウザの挙動に任せるかどうか分岐する。
 */
function onArrowUp(event: KeyboardEvent) {
  const selectedItemPaths = CurrentState.getSelectedItemPaths()
  const aboveItemPath = CurrentState.findAboveItemPath(selectedItemPaths.first())
  // 上のアイテムが存在しない場合はブラウザの挙動に任せる
  if (aboveItemPath === undefined) return

  // 複数選択などの場合、上のアイテムをフォーカスするだけで終了
  const targetItemPath = CurrentState.getTargetItemPath()
  if (document.activeElement?.id !== MainAreaContentView.focusableDomElementId(targetItemPath)) {
    event.preventDefault()
    CurrentState.setTargetItemPath(aboveItemPath)
    Rerenderer.instance.rerender()
    return
  }

  const targetItemId = ItemPath.getItemId(targetItemPath)
  if (Internal.instance.state.items[targetItemId].itemType === ItemType.TEXT) {
    // ターゲットアイテムがテキストアイテムの場合

    assertNonNull(document.activeElement)
    const activeElementRect = document.activeElement?.getBoundingClientRect()
    const selectionRect = getSelection()?.getRangeAt(0)?.getBoundingClientRect()
    assertNonUndefined(selectionRect)

    // キャレットが最初の行以外にいるときはブラウザの挙動に任せる
    const fontSize = getComputedStyle(document.activeElement).getPropertyValue('font-size')
    if (selectionRect.top - activeElementRect.top > parseFloat(fontSize) / 2) {
      return
    }
  }

  event.preventDefault()
  moveFocusToAboveItem(aboveItemPath)
}

function moveFocusToAboveItem(aboveItemPath: ItemPath) {
  const aboveItemId = ItemPath.getItemId(aboveItemPath)
  if (Internal.instance.state.items[aboveItemId].itemType === ItemType.TEXT) {
    // 上のアイテムがテキストアイテムの場合、X座標をできるだけ保つようなキャレット移動を行う

    // 現在のX座標を取得
    const originalXCoordinate = getCaretXCoordinate()
    assertNonUndefined(originalXCoordinate)

    // 上のアイテムの最後の行の文字数を取得
    const aboveItemDomishObjects = Internal.instance.state.textItems[aboveItemId].domishObjects
    const lines = DomishObject.toPlainText(aboveItemDomishObjects).split(/\r?\n/)
    const lastLine = lines[lines.length - 1]

    // 上のアイテムに一旦フォーカスする
    const aboveItemDomElementId = MainAreaContentView.focusableDomElementId(aboveItemPath)
    const aboveItemDomElement = document.getElementById(aboveItemDomElementId)
    assertNonNull(aboveItemDomElement)
    aboveItemDomElement.focus()

    const charactersCount = DomishObject.countCharacters(aboveItemDomishObjects)
    // キャレット位置を最後の行の右端からスタートし、左にずらしていく
    let i = charactersCount
    for (; charactersCount - lastLine.length <= i; i--) {
      setCaretPosition(i)
      const caretXCoordinate = getCaretXCoordinate()!
      if (caretXCoordinate === originalXCoordinate) {
        CurrentState.setTargetItemPath(aboveItemPath)
        Rerenderer.instance.requestSelectAfterRendering(getTextItemSelectionFromDom())
        Rerenderer.instance.rerender()
        return
      }
      if (caretXCoordinate < originalXCoordinate) {
        break
      }
    }
    // もしi < 0なら既にsetCaretPosition(0)が実行済みなので、このままreturnしていい
    if (i < 0) {
      CurrentState.setTargetItemPath(aboveItemPath)
      Rerenderer.instance.requestSelectAfterRendering(getTextItemSelectionFromDom())
      Rerenderer.instance.rerender()
      return
    }

    // キャレットのX座標の移動距離が最も小さくなるようなpositionを選ぶ
    if (i < charactersCount) {
      // TODO: 最適化の余地あり（setCaretPositionやgetCaretXCoordinateの呼び出し回数）
      setCaretPosition(i + 1)
      const firstDistance = Math.abs(originalXCoordinate - getCaretXCoordinate()!)
      setCaretPosition(i)
      const secondDistance = Math.abs(originalXCoordinate - getCaretXCoordinate()!)
      if (firstDistance < secondDistance) {
        setCaretPosition(i + 1)
      }
    }
  }

  CurrentState.setTargetItemPath(aboveItemPath)
  Rerenderer.instance.requestSelectAfterRendering(getTextItemSelectionFromDom())
  Rerenderer.instance.rerender()
}

/**
 * ↓キー押下時の処理。
 * キャレット位置によってブラウザの挙動に任せるかどうか分岐する。
 */
function onArrowDown(event: KeyboardEvent) {
  const selectedItemPaths = CurrentState.getSelectedItemPaths()
  const belowItemPath = CurrentState.findBelowItemPath(selectedItemPaths.last())
  // 下のアイテムが存在しない場合はブラウザの挙動に任せる
  if (belowItemPath === undefined) return

  // 複数選択などの場合、下のアイテムをフォーカスするだけで終了
  const targetItemPath = CurrentState.getTargetItemPath()
  if (document.activeElement?.id !== MainAreaContentView.focusableDomElementId(targetItemPath)) {
    event.preventDefault()
    CurrentState.setTargetItemPath(belowItemPath)
    Rerenderer.instance.rerender()
    return
  }

  const targetItemId = ItemPath.getItemId(targetItemPath)
  if (Internal.instance.state.items[targetItemId].itemType === ItemType.TEXT) {
    // ターゲットアイテムがテキストアイテムの場合

    assertNonNull(document.activeElement)
    const activeElementRect = document.activeElement?.getBoundingClientRect()
    const selectionRect = getSelection()?.getRangeAt(0)?.getBoundingClientRect()
    assertNonUndefined(selectionRect)

    if (selectionRect.bottom === 0) {
      // どういうわけかキャレットが先頭に居るときにselectionRectの値が全て0になってしまう問題への対処

      const fontSize = getComputedStyle(document.activeElement).getPropertyValue('font-size')
      if (activeElementRect.height >= parseFloat(fontSize) * 2) {
        // br要素を含むか、あるいは折り返しが起こっている場合はブラウザの挙動に任せる
        return
      }
    } else {
      // キャレットが最後の行以外にいるときはブラウザの挙動に任せる
      const fontSize = getComputedStyle(document.activeElement).getPropertyValue('font-size')
      if (activeElementRect.bottom - selectionRect.bottom > parseFloat(fontSize) / 2) {
        return
      }
    }
  }

  event.preventDefault()
  moveFocusToBelowItem(belowItemPath)
}

function moveFocusToBelowItem(belowItemPath: ItemPath) {
  const belowItemId = ItemPath.getItemId(belowItemPath)
  if (Internal.instance.state.items[belowItemId].itemType === ItemType.TEXT) {
    // 下のアイテムがテキストアイテムの場合、X座標をできるだけ保つようなキャレット移動を行う

    // 現在のX座標を取得
    const originalXCoordinate = getCaretXCoordinate()
    assertNonUndefined(originalXCoordinate)

    // 下のアイテムの最初の行の文字数を取得
    const belowItemDomishObjects = Internal.instance.state.textItems[belowItemId].domishObjects
    const firstLine = DomishObject.toPlainText(belowItemDomishObjects).split(/\r?\n/)[0]

    // 下のアイテムに一旦フォーカスする（キャレット位置を左端からスタートし、右にずらしていく）
    // TODO: 最適化の余地あり。二分探索が可能では？
    const belowItemDomElementId = MainAreaContentView.focusableDomElementId(belowItemPath)
    const belowItemDomElement = document.getElementById(belowItemDomElementId)
    assertNonNull(belowItemDomElement)
    belowItemDomElement.focus()

    let i = 0
    for (; i < firstLine.length; i++) {
      setCaretPosition(i)
      if (getCaretXCoordinate()! > originalXCoordinate) {
        break
      }
    }
    // キャレットのX座標の移動距離が最も小さくなるようなpositionを選ぶ
    if (i > 0) {
      // TODO: 最適化の余地あり（setCaretPositionやgetCaretXCoordinateの呼び出し回数）
      setCaretPosition(i - 1)
      const firstDistance = Math.abs(originalXCoordinate - getCaretXCoordinate()!)
      setCaretPosition(i)
      const secondDistance = Math.abs(originalXCoordinate - getCaretXCoordinate()!)
      if (firstDistance < secondDistance) {
        setCaretPosition(i - 1)
      }
    }
  }
  CurrentState.setTargetItemPath(belowItemPath)
  Rerenderer.instance.requestSelectAfterRendering(getTextItemSelectionFromDom())
  Rerenderer.instance.rerender()
}

function setCaretPosition(position: integer) {
  assertNonNull(document.activeElement)
  setDomSelection(document.activeElement, {
    focusDistance: position,
    anchorDistance: position,
  })
}

function getCaretXCoordinate(): integer | undefined {
  const selection = getSelection()
  if (selection !== null && selection.rangeCount > 0) {
    if (selection.getRangeAt(0).getBoundingClientRect().left === 0) {
      // どういうわけかキャレットが先頭に居るときにX座標が0扱いになってしまう問題の対策
      // TODO: marginなどを入れられると破綻するのでは
      return document.activeElement?.getBoundingClientRect().left
    }
    return selection.getRangeAt(0).getBoundingClientRect().left
  }
  return undefined
}

/**
 * Shift+↑キー押下時の処理。アイテムの複数選択を行うためのもの。
 * キャレット位置によってブラウザの挙動に任せるかどうか分岐する。
 */
function onShiftArrowUp(event: KeyboardEvent) {
  const targetItemPath = CurrentState.getTargetItemPath()
  const prevSiblingItemPath = CurrentState.findPrevSiblingItemPath(targetItemPath)
  // 兄アイテムが存在しない場合はブラウザの挙動に任せる
  if (prevSiblingItemPath === undefined) return

  if (CurrentState.getSelectedItemPaths().size === 1) {
    const targetItemId = ItemPath.getItemId(targetItemPath)
    if (Internal.instance.state.items[targetItemId].itemType === ItemType.TEXT) {
      // ターゲットアイテムがテキストアイテムの場合

      const textItemSelection = getTextItemSelectionFromDom()
      if (textItemSelection !== undefined && textItemSelection.focusDistance > 0) {
        return
      }
    }
  }

  event.preventDefault()
  CurrentState.setTargetItemPathOnly(prevSiblingItemPath)
  // 複数選択中はメインエリア自体をフォーカスする
  focusMainAreaBackground()
  Rerenderer.instance.rerender()
}

/**
 * Shift+↓キー押下時の処理。アイテムの複数選択を行うためのもの。
 * キャレット位置によってブラウザの挙動に任せるかどうか分岐する。
 */
function onShiftArrowDown(event: KeyboardEvent) {
  const targetItemPath = CurrentState.getTargetItemPath()
  const nextSiblingItemPath = CurrentState.findNextSiblingItemPath(targetItemPath)
  // 弟アイテムが存在しない場合はブラウザの挙動に任せる
  if (nextSiblingItemPath === undefined) return

  if (CurrentState.getSelectedItemPaths().size === 1) {
    const targetItemId = ItemPath.getItemId(targetItemPath)
    if (Internal.instance.state.items[targetItemId].itemType === ItemType.TEXT) {
      // ターゲットアイテムがテキストアイテムの場合

      const domishObjects = Internal.instance.state.textItems[targetItemId].domishObjects
      const charactersCount = DomishObject.countCharacters(domishObjects)
      const textItemSelection = getTextItemSelectionFromDom()
      if (textItemSelection !== undefined && textItemSelection.focusDistance < charactersCount) {
        return
      }
    }
  }

  event.preventDefault()
  CurrentState.setTargetItemPathOnly(nextSiblingItemPath)
  // 複数選択中はメインエリア自体をフォーカスする
  focusMainAreaBackground()
  Rerenderer.instance.rerender()
}

/** メインエリア上でBackspaceキーを押したときのデフォルトの挙動 */
function onBackspace(event: KeyboardEvent) {
  // 複数選択中は選択されたアイテムを削除して終了
  if (CurrentState.getSelectedItemPaths().size > 1) {
    event.preventDefault()
    NullaryCommand.deleteItem()
    Rerenderer.instance.rerender()
    return
  }

  const targetItemPath = CurrentState.getTargetItemPath()
  const targetItemId = ItemPath.getItemId(targetItemPath)
  const targetItem = Internal.instance.state.items[targetItemId]
  if (targetItem.itemType === ItemType.TEXT) {
    // ターゲットアイテムがテキストアイテムの場合

    const selection = getTextItemSelectionFromDom()
    assertNonUndefined(selection)
    if (selection.focusDistance === 0 && selection.anchorDistance === 0) {
      // キャレットが先頭にあるなら

      const aboveItemPath = CurrentState.findAboveItemPath(targetItemPath)
      // アクティブアイテムなら何もしない
      if (aboveItemPath === undefined) return

      const aboveItemId = ItemPath.getItemId(aboveItemPath)

      const domishObjects = Internal.instance.state.textItems[targetItemId].domishObjects
      // 空の子なしアイテムなら
      if (targetItem.childItemIds.isEmpty() && DomishObject.countCharacters(domishObjects) === 0) {
        event.preventDefault()

        // 上のアイテムがテキストアイテムならキャレットを末尾に移す
        if (Internal.instance.state.items[aboveItemId].itemType === ItemType.TEXT) {
          const domishObjects = Internal.instance.state.textItems[aboveItemId].domishObjects
          const characterCount = DomishObject.countCharacters(domishObjects)
          Rerenderer.instance.requestSetCaretDistanceAfterRendering(characterCount)
        }

        // ターゲットアイテムを削除して終了
        NullaryCommand.deleteItem()
        Rerenderer.instance.rerender()
        return
      }

      if (Internal.instance.state.items[aboveItemId].itemType !== ItemType.TEXT) {
        // 上のアイテムがテキストアイテム以外の場合
        // TODO: アイテム削除コマンドを実行するのがいいと思う
      } else {
        // ターゲットアイテムも上のアイテムもテキストアイテムの場合、テキストアイテム同士のマージを行う

        // テキストを連結
        const focusedItemDomishObjects =
          Internal.instance.state.textItems[targetItemId].domishObjects
        const aboveItemDomishObjects = Internal.instance.state.textItems[aboveItemId].domishObjects
        // TODO: テキストノード同士が連結されないことが気がかり
        CurrentState.setTextItemDomishObjects(
          aboveItemId,
          aboveItemDomishObjects.concat(focusedItemDomishObjects)
        )

        // 子リストを連結するため、子を全て弟としてエッジ追加。
        // アンインデントに似ているが元のエッジを削除しない点が異なる。
        for (const childItemId of targetItem.childItemIds.reverse()) {
          CurrentState.insertLastChildItem(aboveItemId, childItemId)
        }

        // ↑の元のエッジごと削除
        CurrentState.deleteItem(targetItemId)

        // 上のアイテムの元の末尾にキャレットを移動する
        CurrentState.setTargetItemPath(aboveItemPath)
        Rerenderer.instance.requestSetCaretDistanceAfterRendering(
          DomishObject.countCharacters(aboveItemDomishObjects)
        )

        event.preventDefault()
        Rerenderer.instance.rerender()
      }
    }
  } else {
    // ターゲットアイテムがテキストアイテム以外の場合

    event.preventDefault()
    // ターゲットアイテムを削除する
    NullaryCommand.deleteItem()
    Rerenderer.instance.rerender()
  }
}

/** メインエリア上でDeleteキーを押したときのデフォルトの挙動 */
function onDelete(event: KeyboardEvent) {
  // 複数選択中は選択されたアイテムを削除して終了
  if (CurrentState.getSelectedItemPaths().size > 1) {
    event.preventDefault()
    NullaryCommand.deleteItem()
    // 下のアイテムをフォーカスする
    const belowItemPath = CurrentState.findBelowItemPath(CurrentState.getTargetItemPath())
    if (belowItemPath !== undefined) {
      CurrentState.setTargetItemPath(belowItemPath)
    }
    Rerenderer.instance.rerender()
    return
  }

  const targetItemPath = CurrentState.getTargetItemPath()
  const targetItemId = ItemPath.getItemId(targetItemPath)
  const targetItem = Internal.instance.state.items[targetItemId]
  if (targetItem.itemType === ItemType.TEXT) {
    // ターゲットアイテムがテキストアイテムの場合

    const domishObjects = Internal.instance.state.textItems[targetItemId].domishObjects
    // 空の子なしアイテムなら
    if (targetItem.childItemIds.isEmpty() && DomishObject.countCharacters(domishObjects) === 0) {
      event.preventDefault()
      // ターゲットアイテムを削除して終了
      NullaryCommand.deleteItem()
      // 下のアイテムをフォーカスする
      const belowItemPath = CurrentState.findBelowItemPath(CurrentState.getTargetItemPath())
      if (belowItemPath !== undefined) {
        CurrentState.setTargetItemPath(belowItemPath)
      }
      Rerenderer.instance.rerender()
      return
    }

    const selection = getTextItemSelectionFromDom()
    assertNonUndefined(selection)

    const focusedItemDomishObjects = Internal.instance.state.textItems[targetItemId].domishObjects
    const characterCount = DomishObject.countCharacters(focusedItemDomishObjects)
    if (selection.focusDistance === characterCount && selection.anchorDistance === characterCount) {
      // キャレットが末尾にあるなら

      const belowItemPath = CurrentState.findBelowItemPath(targetItemPath)
      // 一番下のアイテムなら何もしない
      if (belowItemPath === undefined) return

      const belowItemId = ItemPath.getItemId(belowItemPath)
      const belowItem = Internal.instance.state.items[belowItemId]
      if (belowItem.itemType !== ItemType.TEXT) {
        // 下のアイテムがテキストアイテム以外の場合
        // TODO: アイテム削除コマンドを実行するのがいいと思う
      } else {
        // ターゲットアイテムも下のアイテムもテキストアイテムの場合、テキストアイテム同士のマージを行う

        // テキストを連結
        const belowItemDomishObjects = Internal.instance.state.textItems[belowItemId].domishObjects
        // TODO: テキストノード同士が連結されないことが気がかり
        CurrentState.setTextItemDomishObjects(
          targetItemId,
          focusedItemDomishObjects.concat(belowItemDomishObjects)
        )

        // 子リストを連結するため、下のアイテムの子を全てその弟としてエッジ追加。
        // アンインデントに似ているが元のエッジを削除しない点が異なる。
        for (const childItemId of belowItem.childItemIds) {
          CurrentState.insertLastChildItem(targetItemId, childItemId)
        }

        // ↑の元のエッジごと削除
        CurrentState.deleteItem(belowItemId)

        // 元のキャレット位置を維持する
        Rerenderer.instance.requestSetCaretDistanceAfterRendering(
          DomishObject.countCharacters(focusedItemDomishObjects)
        )

        event.preventDefault()
        Rerenderer.instance.rerender()
      }
    }
  } else {
    // ターゲットアイテムがテキストアイテム以外の場合

    event.preventDefault()
    // ターゲットアイテムを削除する
    NullaryCommand.deleteItem()
    // 下のアイテムをフォーカスする
    const belowItemPath = CurrentState.findBelowItemPath(CurrentState.getTargetItemPath())
    if (belowItemPath !== undefined) {
      CurrentState.setTargetItemPath(belowItemPath)
    }
    Rerenderer.instance.rerender()
  }
}

/** メインエリア上でSpaceキーを押したときのデフォルトの挙動 */
function onSpace(event: KeyboardEvent) {
  const targetItemId = ItemPath.getItemId(CurrentState.getTargetItemPath())
  const targetItemType = Internal.instance.state.items[targetItemId].itemType
  if (targetItemType === ItemType.WEB_PAGE) {
    event.preventDefault()
    NullaryCommand.browseTab()
    Rerenderer.instance.rerender()
  }
}

async function undo() {
  if (External.instance.hardUnloadedTabIds.size > 0) return
  if (External.instance.urlToItemIdsForTabCreation.size > 0) return

  if (Internal.instance.prevState !== undefined) {
    assertNonUndefined(External.instance.prevPendingMutatedChunkIds)

    Internal.instance.state = Internal.instance.prevState
    Internal.instance.prevState = undefined
    External.instance.pendingMutatedChunkIds = External.instance.prevPendingMutatedChunkIds
    External.instance.prevPendingMutatedChunkIds = undefined
    await matchTabsAndWebPageItems()

    Rerenderer.instance.rerender()
  }
}

function onDragImageBottom(event: MouseEvent, itemId: ItemId, imageRectTop: integer) {
  const heightPx = Math.max(0, event.clientY - imageRectTop)
  Internal.instance.mutate(heightPx, PropertyPath.of('imageItems', itemId, 'heightPx'))
}
