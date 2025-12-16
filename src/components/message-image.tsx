'use client'

import { useState } from 'react'
import { ImageIcon } from 'lucide-react'

interface MessageImageProps {
  imageUrl?: string
  thumbnailUrl?: string
}

export function MessageImage({ imageUrl, thumbnailUrl }: MessageImageProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const url = thumbnailUrl || imageUrl

  if (!url) {
    return (
      <div className="bg-zinc-100 rounded-lg p-6 text-center">
        <ImageIcon className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">Imagem enviada</p>
      </div>
    )
  }

  if (hasError) {
    return (
      <div className="bg-zinc-100 rounded-lg p-8 text-center">
        <ImageIcon className="w-12 h-12 text-zinc-400 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">Imagem não disponível</p>
        <p className="text-xs text-zinc-400">URL expirada ou protegida</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 bg-zinc-100 rounded-lg flex items-center justify-center">
          <div className="animate-pulse text-zinc-400 text-sm">Carregando...</div>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src={url}
        alt="Imagem enviada"
        className={`max-w-full max-h-64 rounded-lg object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
      />
    </div>
  )
}
