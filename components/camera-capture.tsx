"use client"

import { useRef, useState, useEffect } from "react"
import { Camera, X, RotateCw, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CameraCaptureProps {
  onCapture: (imageData: string) => void
  onClose: () => void
  instructions?: string
}

export function CameraCapture({ onCapture, onClose, instructions }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment")

  useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [facingMode])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error("Error accessing camera:", error)
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
  }

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(video, 0, 0)
        const imageData = canvas.toDataURL("image/jpeg", 0.8)
        setCapturedImage(imageData)
      }
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
  }

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage)
      stopCamera()
    }
  }

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="flex items-center justify-between">
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          {!capturedImage && (
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
              onClick={toggleCamera}
            >
              <RotateCw className="h-5 w-5" />
            </Button>
          )}
        </div>
        {instructions && (
          <div className="mt-4 text-center">
            <p className="text-sm text-white/90 font-medium">{instructions}</p>
          </div>
        )}
      </div>

      {/* Camera Preview or Captured Image */}
      <div className="relative h-full w-full flex items-center justify-center">
        {!capturedImage ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </>
        ) : (
          <img src={capturedImage || "/placeholder.svg"} alt="Captured" className="h-full w-full object-contain" />
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-8">
        {!capturedImage ? (
          <div className="flex items-center justify-center">
            <Button size="icon" className="h-20 w-20 rounded-full bg-white hover:bg-white/90" onClick={capturePhoto}>
              <Camera className="h-8 w-8 text-black" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full bg-white/10 text-white border-white/20 hover:bg-white/20"
              onClick={handleRetake}
            >
              Retake
            </Button>
            <Button
              size="lg"
              className="rounded-full bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirm}
            >
              <Check className="h-5 w-5 mr-2" />
              Send Photo
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
