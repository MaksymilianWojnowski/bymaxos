export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex h-[26px] w-full items-center justify-between text-left"
    >
      <span aria-hidden="true">{label}</span>
      <span
        aria-hidden="true"
        className={`relative h-[20px] w-[34px] shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-black/20 dark:bg-white/25'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[16px] w-[16px] rounded-full bg-white transition-transform ${
            checked ? 'translate-x-[16px]' : 'translate-x-[2px]'
          }`}
        />
      </span>
    </button>
  )
}
