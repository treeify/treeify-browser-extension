import {State} from 'src/TreeifyTab/Internal/State'
import {createDialogLayerProps, DialogLayerProps} from 'src/TreeifyTab/View/Dialog/DialogLayer'
import {createDragImageProps, DragImageProps} from 'src/TreeifyTab/View/DragImageProps'
import {
  createLeftSidebarProps,
  LeftSidebarProps,
} from 'src/TreeifyTab/View/LeftSidebar/LeftSidebarProps'
import {createMainAreaProps, MainAreaProps} from 'src/TreeifyTab/View/MainArea/MainAreaProps'
import {createToolbarProps, ToolbarProps} from 'src/TreeifyTab/View/Toolbar/ToolbarProps'

export type RootProps = {
  leftSidebarProps: LeftSidebarProps
  mainAreaProps: MainAreaProps
  toolbarProps: ToolbarProps
  dialogLayerProps: DialogLayerProps
  dragImageProps: DragImageProps | undefined
}

export function createRootProps(state: State): RootProps {
  return {
    leftSidebarProps: createLeftSidebarProps(state),
    mainAreaProps: createMainAreaProps(state),
    toolbarProps: createToolbarProps(),
    dialogLayerProps: createDialogLayerProps(state),
    dragImageProps: createDragImageProps(),
  }
}
