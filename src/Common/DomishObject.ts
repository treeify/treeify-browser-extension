import {List} from 'immutable'
import {html, TemplateResult} from 'lit-html'
import {assertNeverType} from 'src/Common/Debug/assert'

/**
 * DOM要素っぽいオブジェクトの型。
 * contenteditableな要素のinnerHTMLを安全に扱うために導入した。
 */
export type DomishObject = DomishObject.Element | DomishObject.TextNode

export namespace DomishObject {
  export type Element = BElement | UElement | IElement | BRElement

  export type BElement = {
    type: 'b'
    children: List<DomishObject>
  }
  export type UElement = {
    type: 'u'
    children: List<DomishObject>
  }
  export type IElement = {
    type: 'i'
    children: List<DomishObject>
  }

  export type BRElement = {
    type: 'br'
  }

  export type TextNode = {
    type: 'text'
    textContent: string
  }

  /** DomishObjectをlit-htmlでDOM要素に変換する（厳密にはDOMではないが） */
  export function toTemplateResult(value: DomishObject | List<DomishObject>): TemplateResult {
    if (value instanceof List) {
      const domishObjects = value as List<DomishObject>
      return html`${domishObjects.map(toTemplateResult)}`
    } else {
      const domishObject = value as DomishObject
      switch (domishObject.type) {
        case 'b':
          return html`<b>${domishObject.children.map(toTemplateResult)}</b>`
        case 'u':
          return html`<u>${domishObject.children.map(toTemplateResult)}</u>`
        case 'i':
          return html`<i>${domishObject.children.map(toTemplateResult)}</i>`
        case 'br':
          return html`<br />`
        case 'text':
          return html`${domishObject.textContent}`
        default:
          assertNeverType(domishObject)
      }
    }
  }

  /**
   * 与えられたNodeの子リストをDomishObjectのリストに変換する。
   * DomishObjectとして表せない子Nodeは無視される。
   */
  export function fromChildren(node: Node): List<DomishObject> {
    return List(Array.from(node.childNodes))
      .map(from)
      .filter((value) => value !== undefined) as List<DomishObject>
  }

  /**
   * 与えられたNodeをDomishObjectに変換する。
   * DomishObjectとして表せない場合はundefinedを返す。
   */
  export function from(node: Node): DomishObject | undefined {
    if (node instanceof HTMLBRElement) {
      return {type: 'br'}
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return {type: 'text', textContent: node.textContent ?? ''}
    }
    if (node instanceof HTMLElement) {
      switch (node.tagName.toLowerCase()) {
        case 'b':
          return {
            type: 'b',
            children: fromChildren(node),
          }
        case 'u':
          return {
            type: 'u',
            children: fromChildren(node),
          }
        case 'i':
          return {
            type: 'i',
            children: fromChildren(node),
          }
      }
      return undefined
    }
    return undefined
  }
}
