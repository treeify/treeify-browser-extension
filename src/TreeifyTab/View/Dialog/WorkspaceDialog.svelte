<script lang="ts">
  import {doWithErrorCapture} from '../../errorCapture'
  import {CurrentState} from '../../Internal/CurrentState'
  import {Rerenderer} from '../../Rerenderer'
  import CommonDialog from './CommonDialog.svelte'
  import {WorkspaceDialogProps} from './WorkspaceDialogProps'
  import WorkspaceDialogRow from './WorkspaceDialogRow.svelte'

  export let props: WorkspaceDialogProps

  const closeDialog = () => {
    doWithErrorCapture(() => {
      CurrentState.setDialog(null)
      Rerenderer.instance.rerender()
    })
  }
</script>

<CommonDialog title="ワークスペース">
  <div class="workspace-dialog_content" tabindex="0">
    {#each props.workspaces.toArray() as workspace}
      <WorkspaceDialogRow {workspace} />
    {/each}
    <div class="workspace-dialog_add-button" on:click={props.onClickAddButton} />
    <button class="workspace-dialog_close-button" on:click={closeDialog}>閉じる</button>
  </div>
</CommonDialog>

<style>
  :root {
    /* 作成ボタンのサイズ（正方形の一辺の長さ） */
    --workspace-dialog-add-button-size: 22px;
  }

  .workspace-dialog_content {
    padding: 1em;

    /* フォーカス時の枠線を非表示 */
    outline: 0 solid transparent;
  }

  .workspace-dialog_add-button {
    width: var(--workspace-dialog-add-button-size);
    height: var(--workspace-dialog-add-button-size);

    margin: 3px auto;

    background: hsl(0, 0%, 35%);
    -webkit-mask: url('./plus-icon.svg') no-repeat center;
    -webkit-mask-size: contain;

    cursor: pointer;
  }

  .workspace-dialog_close-button {
    /* 右寄せにする */
    display: block;
    margin-left: auto;

    margin-top: 1em;
  }
</style>
