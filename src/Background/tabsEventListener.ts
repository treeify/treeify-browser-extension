import {integer, StableTab} from 'src/Common/basicType'
import {assertNonUndefined} from 'src/Common/Debug/assert'
import {TreeifyWindow} from 'src/TreeifyWindow/TreeifyWindow'
import Tab = chrome.tabs.Tab

// TODO: 永続化された値で初期化する
let nextNewStableTabId = 1

// StableTabの集まりに対するオンメモリインデックスの1つ
const stableTabMapFromTabId = new Map<integer, StableTab>()

/** 現時点で存在するタブの情報を収集し、必要に応じてStableTabIdの発行などを行う */
export async function processExistingTabs() {
  const allTabs = await getAllNormalTabs()
  for (const tab of allTabs) {
    await onCreated(tab)
  }
}

async function getAllNormalTabs(): Promise<Tab[]> {
  return new Promise((resolve) => {
    chrome.windows.getAll({populate: true, windowTypes: ['normal']}, (windows) => {
      resolve(windows.flatMap((window) => window.tabs ?? []))
    })
  })
}

export async function onCreated(tab: Tab) {
  assertNonUndefined(tab.id)

  const openerStableTab =
    tab.openerTabId !== undefined ? stableTabMapFromTabId.get(tab.openerTabId) : undefined

  const stableTab: StableTab = {
    stableTabId: nextNewStableTabId++,
    opener: openerStableTab?.stableTabId ?? null,
    ...tab,
  }
  stableTabMapFromTabId.set(stableTab.id!, stableTab)

  if (await TreeifyWindow.exists()) {
    // TODO: Treeifyウィンドウが存在したとしてもready状態かどうかは分からないのでは？

    // Treeifyウィンドウが存在するときはイベントを転送する
    TreeifyWindow.sendMessage({
      type: 'OnTabCreated',
      stableTab,
    })
  }
}
