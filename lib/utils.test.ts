import { cn } from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('px-2 py-1', 'px-4')
      expect(result).toBe('py-1 px-4')
    })

    it('should handle conditional classes', () => {
      const isActive = true
      const result = cn('base-class', isActive && 'active-class')
      expect(result).toBe('base-class active-class')
    })

    it('should handle falsy values', () => {
      const result = cn('base-class', false, null, undefined, 0)
      expect(result).toBe('base-class')
    })

    it('should merge tailwind classes correctly', () => {
      const result = cn('text-red-500', 'text-blue-500')
      expect(result).toBe('text-blue-500')
    })

    it('should handle arrays', () => {
      const result = cn(['class-1', 'class-2'], 'class-3')
      expect(result).toBe('class-1 class-2 class-3')
    })

    it('should handle objects', () => {
      const result = cn({
        'class-1': true,
        'class-2': false,
        'class-3': true,
      })
      expect(result).toBe('class-1 class-3')
    })
  })
})
