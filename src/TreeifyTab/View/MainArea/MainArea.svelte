<script lang="ts">
  import {onCopy, onCut, onPaste} from '../../Internal/ImportExport/clipboard'
  import {onDragImageBottom} from '../dragAndDrop'
  import MainAreaNode from './MainAreaNode.svelte'
  import {MainAreaProps} from './MainAreaProps'

  export let props: MainAreaProps
</script>

<main
  class="main-area"
  tabindex="0"
  on:keydown={props.onKeyDown}
  on:copy={onCopy}
  on:cut={onCut}
  on:paste={onPaste}
  use:onDragImageBottom={props.onDragImageBottom}
>
  {#key props.rootNodeProps.itemPath.toString()}
    <MainAreaNode props={props.rootNodeProps} />
  {/key}
</main>

<style>
  :root {
    --main-area-base-font-size: 15px;

    /*
    メインエリアのテキスト全般に適用されるline-height。
    階層が深くなるごとにフォントサイズなどが小さくなる仕組みを実現するために比率で指定しなければならない。
    */
    --main-area-line-height: 1.45;
    /* メインエリア内で階層が深くなるごとにフォントサイズなどが小さくなる仕組みに用いられる乗数 */
    --main-area-font-size-multiplicator: 99.5%;

    /* フォントサイズをline-height（比率指定）を乗算して、行の高さを算出する */
    --main-area-calculated-line-height: calc(
      1em * var(--main-area-line-height) + var(--main-area-body-area-vertical-padding)
    );
  }

  .main-area {
    overflow-y: auto;

    font-size: var(--main-area-base-font-size);
    line-height: var(--main-area-line-height);

    padding: 15px 300px 150px 15px;

    /* フォーカス時の枠線を非表示 */
    outline: 0 solid transparent;
  }
</style>
