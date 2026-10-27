import type { ComponentType, ReactNode } from 'react'
import type { Command } from '../system/commands'
import type { AppId, Size, WindowState } from '../system/types'

export interface AppProps {
  windowId: string
  props?: Record<string, unknown>
}

export type MenuItemDef =
  | { label: string; command?: Command; shortcut?: string; checked?: boolean; disabled?: boolean }
  | { separator: true }

export interface MenuDef {
  id: string
  label: ReactNode
  items: MenuItemDef[]
}

export interface MenuContext {
  focused: WindowState | null
  windows: WindowState[]
  keyboardLocked: boolean
}

export interface AppIconSpec {
  glyph: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  background: string
  color?: string
}

export interface AppDefinition {
  id: AppId
  name: string
  icon: AppIconSpec
  load?: () => Promise<{ default: ComponentType<AppProps> }>
  external?: string
  alias?: { appId: AppId; props?: Record<string, unknown> }
  window?: { defaultSize: Size; minSize: Size; resizable: boolean; singleInstance: boolean }
  menus?: (ctx: MenuContext) => MenuDef[]
  dock?: { order: number; group: 'system' | 'apps' | 'links' | 'trash' }
  mobile?: { presentation: 'fullscreen' | 'sheet' | 'external' | 'hidden' }
}
