import { useToast } from '@/components/ui/Toast'

export function toastSuccess(message: string) {
  if (typeof window !== 'undefined') {
    // If standard alert/toast
    console.log('Success:', message)
  }
}

export function toastError(message: string) {
  if (typeof window !== 'undefined') {
    console.error('Error:', message)
  }
}

export { useToast }
