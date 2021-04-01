import {html} from 'lit-html'
import {CurrentState} from 'src/TreeifyWindow/Internal/CurrentState'
import {NullaryCommand} from 'src/TreeifyWindow/Internal/NullaryCommand'

export function DataFolderPickerOpenButtonView() {
  return html`
    <div class="toolbar-icon-button" @click=${onClick}>
      <div class="data-folder-picker-open-button_icon"></div>
    </div>
  `
}

function onClick() {
  NullaryCommand.openDataFolderPicker()
  CurrentState.commit()
}
