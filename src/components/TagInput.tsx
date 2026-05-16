/**
 * TagInput — reusable multi-select tag field.
 *
 * Used for Sector, Expertise and Contribution Signals on onboarding step 3.
 * Tags can be added from the suggestion dropdown or typed freely (Enter or
 * comma commits the typed value). Backspace on an empty input removes the
 * last tag. `maxTags` caps the selection.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface TagInputProps {
  label: string
  value: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  maxTags?: number
  placeholder?: string
}

export default function TagInput({
  label,
  value,
  onChange,
  suggestions,
  maxTags,
  placeholder,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const atMax = maxTags != null && value.length >= maxTags
  const available = suggestions.filter(
    (s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()),
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || atMax) return
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setInputValue('')
      return
    }
    onChange([...value, tag])
    setInputValue('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag(inputValue)
    } else if (
      event.key === 'Backspace' &&
      inputValue === '' &&
      value.length > 0
    ) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        aria-label={label}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-600"
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-sm font-medium text-blue-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove ${tag}`}
              className="cursor-pointer leading-none text-blue-500 hover:text-blue-800"
            >
              ×
            </button>
          </span>
        ))}

        {!atMax ? (
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder={value.length === 0 ? placeholder : ''}
            className="min-w-[120px] flex-1 border-none bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
          />
        ) : (
          <span className="flex-1 text-xs text-gray-400">(max reached)</span>
        )}

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={`Toggle ${label} suggestions`}
          className="cursor-pointer px-1 text-gray-400 hover:text-gray-600"
        >
          ▾
        </button>
      </div>

      {open && !atMax && available.length > 0 && (
        <ul
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
        >
          {available.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  addTag(suggestion)
                  setOpen(false)
                }}
                className="w-full cursor-pointer rounded-md px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-100"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
