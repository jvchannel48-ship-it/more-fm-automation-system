'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const dark = mounted ? resolvedTheme !== 'light' : true
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {dark ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      <span className="hidden sm:inline">{dark ? 'Dark Theme' : 'Light Theme'}</span>
    </Button>
  )
}
