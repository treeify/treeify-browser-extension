<script lang="ts">
  import {Internal} from 'src/TreeifyTab/Internal/Internal'
  import {Rerenderer} from 'src/TreeifyTab/Rerenderer'
  import {createRootProps, RootProps} from 'src/TreeifyTab/View/RootProps'
  import {derived, Readable} from 'svelte/store'
  import DialogLayer from './Dialog/DialogLayer.svelte'
  import {dragStateResetter} from './dragAndDrop'
  import DragImage from './DragImage.svelte'
  import LeftSidebar from './LeftSidebar/LeftSidebar.svelte'
  import MainArea from './MainArea/MainArea.svelte'
  import Toolbar from './Toolbar/Toolbar.svelte'

  const propsStream: Readable<RootProps> = derived(Rerenderer.instance.rerenderingPulse, () => {
    return createRootProps(Internal.instance.state)
  })
  $: props = $propsStream
</script>

<div class="root" use:dragStateResetter>
  <div class="toolbar-and-sidebar-layout">
    <Toolbar props={props.toolbarProps} />
    <div class="sidebar-layout">
      <LeftSidebar props={props.leftSidebarProps} />
      <MainArea props={props.mainAreaProps} />
    </div>
  </div>
  <DialogLayer props={props.dialogLayerProps} />
  {#if props.dragImageProps !== undefined}
    <DragImage props={props.dragImageProps} />
  {/if}
</div>

<style>
  .root {
    height: 100%;
    /* ダイアログなどを他の表示物に重ねて表示するための設定 */
    position: relative;
  }

  /*
  ツールバーとその他の領域を縦に並べるためのレイアウト。
  */
  .toolbar-and-sidebar-layout {
    /* スクロールされてもツールバーを常に画面上部に表示し続けるための設定 */
    height: 100%;

    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  /* 左サイドバーとメインエリアを横に並べるレイアウト */
  .sidebar-layout {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }
</style>
