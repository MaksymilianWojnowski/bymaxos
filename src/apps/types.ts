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

// Contract: MenuBar memoizes menus on window ids/titles, focusedId, keyboardLocked and openMenuId,
// so app.menus must not depend on any other window or store field.
export interface MenuContext {
  focused: WindowState | null
  windows: WindowState[]
  keyboardLocked: boolean
}

// macOS artwork (image URL, with Apple's built-in margin) or a brand glyph on a squircle.
export type AppIconSpec =
  | { image: string }
  | {
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
  // Apps that need props (a file to show) cannot be opened from a bare link.
  deepLink?: false
}
