/** Open the native file picker for a single image; resolve to a dataURL (or null). */
export function pickImage(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (): void => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = (): void => resolve(null)
      reader.readAsDataURL(file)
    }
    input.click()
  })
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (): void => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = (): void => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}
