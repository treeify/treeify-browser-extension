import {html} from 'lit-html'
import {css} from 'src/TreeifyWindow/View/css'

export type LabelViewModel = {
  text: string
}

export function LabelView(viewModel: LabelViewModel) {
  return html`<span class="label">${viewModel.text}</span>`
}

export const LabelCss = css`
  .label {
    border-radius: 9999px;
    padding: 0 0.25em;

    border: hsl(0, 0%, 80%) 1px solid;
    background: hsl(0, 0%, 95%);
    color: hsl(0, 0%, 30%);
  }
`