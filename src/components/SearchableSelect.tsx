'use client'

import { useState, useRef, useEffect } from 'react'

type Option = {
  value: string
  label: string
}

type Props = {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}

export default function SearchableSelect({ options, value, onChange, placeholder = 'Cari...', required }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Find the selected option's label to display when closed
  const selectedOption = options.find(opt => opt.value === value)
  const displayValue = isOpen ? searchTerm : (selectedOption ? selectedOption.label : '')

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={displayValue}
        required={required && !value}
        onChange={(e) => {
          setSearchTerm(e.target.value)
          if (!isOpen) setIsOpen(true)
          if (e.target.value === '') onChange('')
        }}
        onClick={() => setIsOpen(true)}
      />
      
      {/* Hidden input for real form submission if needed by parent form logic, though typically onChange is enough */}
      <input type="hidden" value={value} required={required} />

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 50,
          marginTop: '0.25rem',
          maxHeight: '250px',
          overflowY: 'auto',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
        }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                  setSearchTerm('')
                }}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  background: opt.value === value ? '#eff6ff' : 'transparent',
                  color: opt.value === value ? '#1e40af' : 'inherit',
                  fontSize: '0.9rem'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = opt.value === value ? '#eff6ff' : 'transparent'}
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div style={{ padding: '0.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              Tidak ditemukan
            </div>
          )}
        </div>
      )}
    </div>
  )
}
