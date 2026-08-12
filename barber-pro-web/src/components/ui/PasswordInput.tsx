import { useState } from 'react'
import { Input, InputProps } from './Input'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput({ ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative w-full">
      <Input
        type={showPassword ? 'text' : 'password'}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 focus:outline-none"
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}