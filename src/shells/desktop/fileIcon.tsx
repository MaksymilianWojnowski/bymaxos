import { Contact, FileText, FileType as FileTypeIcon, Folder, Link, type LucideIcon } from 'lucide-react'
import type { FileType, VNode } from '../../system/vfs'

// Same glyph per file type as Finder, which keeps its own copy.
const FILE_ICON: Record<FileType, LucideIcon> = {
  md: FileText,
  pdf: FileTypeIcon,
  vcf: Contact,
  webloc: Link,
}

export const iconFor = (node: VNode): LucideIcon =>
  node.kind === 'folder' ? Folder : FILE_ICON[node.fileType]
