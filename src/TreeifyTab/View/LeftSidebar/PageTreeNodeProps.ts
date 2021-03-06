import {Collection, List, Seq, Set} from 'immutable'
import {assertNonUndefined} from 'src/Common/Debug/assert'
import {integer} from 'src/Common/integer'
import {ItemId, TOP_ITEM_ID} from 'src/TreeifyTab/basicType'
import {doWithErrorCapture} from 'src/TreeifyTab/errorCapture'
import {External} from 'src/TreeifyTab/External/External'
import {CurrentState} from 'src/TreeifyTab/Internal/CurrentState'
import {Internal} from 'src/TreeifyTab/Internal/Internal'
import {ItemPath} from 'src/TreeifyTab/Internal/ItemPath'
import {State} from 'src/TreeifyTab/Internal/State'
import {Rerenderer} from 'src/TreeifyTab/Rerenderer'
import {
  createItemContentProps,
  ItemContentProps,
} from 'src/TreeifyTab/View/ItemContent/ItemContentProps'
import {
  createPageTreeBulletAndIndentProps,
  PageTreeBulletAndIndentProps,
} from 'src/TreeifyTab/View/LeftSidebar/PageTreeBulletAndIndentProps'

export type PageTreeNodeProps = {
  itemId: ItemId
  bulletAndIndentProps: PageTreeBulletAndIndentProps
  contentProps: ItemContentProps
  childNodePropses: List<PageTreeNodeProps>
  isActivePage: boolean
  isRoot: boolean
  isAudible: boolean
  footprintRank: integer | undefined
  footprintCount: integer
  tabsCount: integer
  onClickContentArea: () => void
  onClickCloseButton: () => void
  onClickTabsCount: () => void
  onDrop: (event: MouseEvent, itemPath: ItemPath) => void
}

export function createPageTreeRootNodeProps(state: State): PageTreeNodeProps {
  const filteredPageIds = CurrentState.getFilteredMountedPageIds()
  const itemPaths = filteredPageIds.flatMap((itemId) => [
    ...searchItemPathForMountedPage(state, List.of(itemId)),
  ])
  const pageTreeEdges = itemPaths
    .groupBy((value) => ItemPath.getRootItemId(value))
    .map((collection) => {
      return collection.toList().sortBy((itemPath) => {
        return toSiblingRankList(itemPath)
      }, lexicographicalOrder)
    })

  return createPageTreeNodeProps(state, List.of(TOP_ITEM_ID), pageTreeEdges, filteredPageIds)
}

// アイテムパスを兄弟順位リストに変換する
function toSiblingRankList(itemPath: ItemPath): List<integer> {
  const siblingRankArray = []
  for (let i = 1; i < itemPath.size; i++) {
    const childItemIds = Internal.instance.state.items[itemPath.get(i - 1)!].childItemIds
    siblingRankArray.push(childItemIds.indexOf(itemPath.get(i)!))
  }
  return List(siblingRankArray)
}

// 辞書式順序のcomparator
function lexicographicalOrder(lhs: List<integer>, rhs: List<integer>): integer {
  const min = Math.min(lhs.size, rhs.size)

  for (let i = 0; i < min; i++) {
    const r = rhs.get(i)!
    const l = lhs.get(i)!
    if (l > r) {
      return 1
    } else if (l < r) {
      return -1
    }
  }
  if (lhs.size === rhs.size) {
    return 0
  } else if (lhs.size > rhs.size) {
    return 1
  } else {
    return -1
  }
}

export function createPageTreeNodeProps(
  state: State,
  itemPath: ItemPath,
  pageTreeEdges: Seq.Keyed<ItemId, Collection<integer, ItemPath>>,
  filteredPageIds: List<ItemId>
): PageTreeNodeProps {
  const itemId = ItemPath.getItemId(itemPath)
  const childPagePaths = pageTreeEdges.get(itemId)?.toList() ?? List.of()
  const displayingChildPagePaths =
    ItemPath.hasParent(itemPath) && CurrentState.getIsCollapsed(itemPath)
      ? List.of<ItemPath>()
      : childPagePaths
  const hasChildren = !pageTreeEdges.get(itemId, List()).isEmpty()

  // TODO: パラメータをカスタマイズ可能にする
  const footprintCount = Math.floor(filteredPageIds.size ** 0.5)
  const rank = filteredPageIds.size - filteredPageIds.indexOf(itemId) - 1

  return {
    itemId,
    bulletAndIndentProps: createPageTreeBulletAndIndentProps(hasChildren, itemPath),
    contentProps: createItemContentProps(itemId),
    childNodePropses: displayingChildPagePaths.map((childPagePath) =>
      createPageTreeNodeProps(state, childPagePath, pageTreeEdges, filteredPageIds)
    ),
    isActivePage: CurrentState.getActivePageId() === itemId,
    isRoot: itemId === TOP_ITEM_ID,
    isAudible: getAudiblePageIds().contains(itemId),
    footprintRank: rank <= footprintCount ? rank : undefined,
    footprintCount,
    tabsCount: CurrentState.countLoadedTabsInSubtree(state, itemId),
    onClickContentArea: () => {
      doWithErrorCapture(() => {
        CurrentState.switchActivePage(itemId)
        Rerenderer.instance.rerender()
      })
    },
    onClickCloseButton: () => {
      doWithErrorCapture(() => {
        if (itemId === TOP_ITEM_ID) return

        Internal.instance.saveCurrentStateToUndoStack()
        CurrentState.unmountPage(itemId)

        // もしアクティブページなら、タイムスタンプが最も新しいページを新たなアクティブページとする
        if (itemId === CurrentState.getActivePageId()) {
          const hottestPageId = Internal.instance.state.mountedPageIds
            .map((pageId) => {
              return {
                pageId,
                timestamp: Internal.instance.state.items[pageId].timestamp,
              }
            })
            .maxBy((a) => a.timestamp)!.pageId
          CurrentState.switchActivePage(hottestPageId)
        }

        Rerenderer.instance.rerender()
      })
    },
    onClickTabsCount: () => {
      doWithErrorCapture(() => {
        Internal.instance.saveCurrentStateToUndoStack()
        // ページ全体をハードアンロードする
        for (const subtreeItemId of CurrentState.getSubtreeItemIds(itemId)) {
          const tabId = External.instance.tabItemCorrespondence.getTabIdBy(subtreeItemId)
          if (tabId !== undefined) {
            // chrome.tabs.onRemovedイベントリスナー内でウェブページアイテムが削除されないよう根回しする
            External.instance.hardUnloadedTabIds.add(tabId)

            // 対応するタブを閉じる
            chrome.tabs.remove(tabId)
          }
        }
      })
    },
    onDrop: (event: MouseEvent, draggedItemPath: ItemPath) => {
      doWithErrorCapture(() => {
        if (!(event.target instanceof HTMLElement)) return

        const draggedItemId = ItemPath.getItemId(draggedItemPath)

        // TODO: 循環チェックをしないと親子間でのドロップとかで壊れるぞ
        // エッジの付け替えを行うので、エッジが定義されない場合は何もしない
        if (ItemPath.getParentItemId(draggedItemPath) === undefined) return

        if (event.altKey) {
          if (!CurrentState.isSibling(itemPath, draggedItemPath)) {
            // エッジを追加する（トランスクルード）
            CurrentState.insertFirstChildItem(itemId, draggedItemId)
          }
        } else {
          // targetItemPathが実在しなくなるので退避
          const aboveItemPath = CurrentState.findAboveItemPath(draggedItemPath)
          assertNonUndefined(aboveItemPath)
          CurrentState.setTargetItemPath(aboveItemPath)

          // エッジを付け替える
          const edge = CurrentState.removeItemGraphEdge(
            ItemPath.getParentItemId(draggedItemPath)!,
            draggedItemId
          )
          CurrentState.insertFirstChildItem(itemId, draggedItemId, edge)
        }

        CurrentState.updateItemTimestamp(draggedItemId)
        Rerenderer.instance.rerender()
      })
    },
  }
}

// マウント済みページを先祖方向に探索し、そのページまでのItemPathを返す。
// 複数該当する場合はすべて返す。
function* searchItemPathForMountedPage(state: State, itemIds: List<ItemId>): Generator<ItemPath> {
  const itemId = itemIds.first(undefined)
  assertNonUndefined(itemId)

  // もし他のマウント済みページに到達したら、そのページまでの経路を返す
  if (itemIds.size > 1 && state.mountedPageIds.contains(itemId)) {
    yield itemIds
    return
  }

  for (const parentItemId of CurrentState.getParentItemIds(itemId)) {
    yield* searchItemPathForMountedPage(state, itemIds.unshift(parentItemId))
  }
}

function getAudiblePageIds(): Set<ItemId> {
  const audibleTabIds = External.instance.tabItemCorrespondence.getAllAudibleTabIds()
  const audibleItemIds = audibleTabIds
    .map((tabId) => External.instance.tabItemCorrespondence.getItemIdBy(tabId))
    .filter((itemId) => itemId !== undefined) as List<ItemId>

  return Set(audibleItemIds.flatMap(CurrentState.getPageIdsBelongingTo))
}
