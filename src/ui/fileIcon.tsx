import docMd from '../assets/icons/doc-md.png'
import docPdf from '../assets/icons/doc-pdf.png'
import docVcf from '../assets/icons/doc-vcf.png'
import docWebloc from '../assets/icons/doc-webloc.png'
import folderDesktop from '../assets/icons/folder-desktop.png'
import folderDocuments from '../assets/icons/folder-documents.png'
import folderPictures from '../assets/icons/folder-pictures.png'
import folder from '../assets/icons/folder.png'
import trash from '../assets/icons/trash.png'
import type { FileType, VNode } from '../system/vfs'

const FILE_ICON: Record<FileType, string> = {
  md: docMd,
  pdf: docPdf,
  vcf: docVcf,
  webloc: docWebloc,
}

// Folders macOS draws with their own artwork.
const FOLDER_ICON: Record<string, string> = {
  desktop: folderDesktop,
  documents: folderDocuments,
  photos: folderPictures,
  trash,
}

// Image URL of the icon Finder shows for this node.
export const iconFor = (node: VNode): string =>
  node.kind === 'folder' ? (FOLDER_ICON[node.id] ?? folder) : FILE_ICON[node.fileType]
