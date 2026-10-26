// Original glyphs: lucide-react 1.61 no longer exports brand icons, and brand logos are not used here.
interface GlyphProps {
  className?: string
  'aria-hidden'?: boolean
}

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'currentColor',
  xmlns: 'http://www.w3.org/2000/svg',
}

export function LinkedInGlyph({ className, 'aria-hidden': ariaHidden }: GlyphProps) {
  return (
    // Even-odd fill: the letter shapes are holes in the rounded square, so the glyph works on any background.
    <svg {...svgProps} className={className} aria-hidden={ariaHidden}>
      <path
        fillRule="evenodd"
        d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z M6.5 10h2.4v7.5H6.5z M9.1 7.2a1.4 1.4 0 1 1-2.8 0a1.4 1.4 0 1 1 2.8 0z M11 10h2.3v1.1c.4-.7 1.3-1.3 2.6-1.3 2.4 0 2.9 1.5 2.9 3.6v4.1h-2.4v-3.6c0-.9 0-2-1.2-2s-1.4.9-1.4 1.9v3.7H11z"
      />
    </svg>
  )
}

export function GitHubGlyph({ className, 'aria-hidden': ariaHidden }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M8 6l-6 6 6 6" />
      <path d="M16 6l6 6-6 6" />
      <path d="M14 4l-4 16" />
    </svg>
  )
}
