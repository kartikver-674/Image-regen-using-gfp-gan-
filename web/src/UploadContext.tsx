import { createContext, useContext, useState } from 'react'

type Upload = { file: File; previewUrl: string }
const Ctx = createContext<{ upload: Upload | null; setUpload: (u: Upload) => void; clear: () => void }>({
  upload: null, setUpload: () => {}, clear: () => {},
})
export const useUpload = () => useContext(Ctx)

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [upload, setUpload] = useState<Upload | null>(null)
  return <Ctx.Provider value={{ upload, setUpload, clear: () => setUpload(null) }}>{children}</Ctx.Provider>
}
