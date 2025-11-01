"use client"

import { useState, useEffect } from "react"
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import useLivekitAudio from "@/hooks/use-livekit-audio"
import { CameraCapture } from "@/components/camera-capture"

interface VoiceModeProps {
  agentDetails: {
    agent_id: string
    agent_name?: string
    version_id?: string
    citations?: boolean
    tool_citations?: boolean
    config?: any
    socketEndpoint?: string
  }
  userDetails?: {
    name: string | undefined
    id: any
  }
  projectId?: string | null
}

export function VoiceMode({ agentDetails, userDetails, projectId }: VoiceModeProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraInstructions, setCameraInstructions] = useState<string>("")

  const {
    status,
    room,
    agentConnected,
    isMicrophoneEnabled,
    connectToRoom,
    handleDisconnect,
    voiceConversationId,
    toggleMuteLocalParticipant,
  } = useLivekitAudio({
    agentDetails,
    userDetails,
    setMessages: (messagesOrUpdater: any) => {
      setMessages((prevMessages) => {
        const newMessages =
          typeof messagesOrUpdater === "function" ? messagesOrUpdater(prevMessages) : messagesOrUpdater

        const latestMessage = newMessages[newMessages.length - 1]
        if (latestMessage?.role === "SimplAi" && latestMessage?.tools) {
          const captureImageTool = latestMessage.tools.find((tool: any) => tool.name === "capture-image")
          if (captureImageTool) {
            // Extract instructions from the tool arguments
            const args = captureImageTool.arguments ? JSON.parse(captureImageTool.arguments) : {}
            setCameraInstructions(args.instructions || "Take a clear photo")
            setShowCamera(true)
          }
        }

        return newMessages
      })
    },
    changeConversation: setConversationId,
    conversationId,
    hasAvatar: false,
    projectId,
  })

  console.log("isMicrophoneEnabled",isMicrophoneEnabled)

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (status === "connected" && agentConnected) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [status, agentConnected])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleCallToggle = () => {
    if (status === "idle" || status === "error") {
      connectToRoom()
      setCallDuration(0)
    } else {
      handleDisconnect()
      setCallDuration(0)
    }
  }

  const handleImageCapture = (imageData: string) => {
    if (room) {
      // Remove the data:image/jpeg;base64, prefix
      const base64Data = imageData.split(",")[1]
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))

      // Send image data on a different topic than agent_communication
      room.localParticipant.publishData(binaryData, {
        topic: "image_capture",
      })

      console.log("[v0] Image sent to LiveKit room on 'image_capture' topic")
    }
    setShowCamera(false)
    setCameraInstructions("")
  }

  const getStatusText = () => {
    switch (status) {
      case "connecting":
        return "Connecting..."
      case "connected":
        return agentConnected ? "Connected" : "Waiting for agent..."
      case "error":
        return "Connection failed"
      default:
        return "Ready to call"
    }
  }

  const isCallActive = status === "connected" || status === "connecting"

  const handleMuteToggle = () => {
    toggleMuteLocalParticipant(isMicrophoneEnabled)
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Voice Indicator */}
          <div className="mb-8 flex flex-col items-center">
            <div
              className={`relative h-32 w-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                isCallActive && agentConnected
                  ? "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 animate-pulse"
                  : "bg-gradient-to-br from-gray-300 to-gray-400"
              }`}
            >
              <div className="absolute inset-2 rounded-full bg-white/20 backdrop-blur-sm" />
              <Phone className={`h-12 w-12 z-10 ${isCallActive ? "text-white" : "text-gray-600"}`} />

              {/* Ripple effect when speaking */}
              {isCallActive && agentConnected && isMicrophoneEnabled && (
                <>
                  <div className="absolute inset-0 rounded-full bg-indigo-400/30 animate-ping" />
                  <div className="absolute inset-0 rounded-full bg-purple-400/20 animate-ping animation-delay-150" />
                </>
              )}
            </div>

            {/* Status Text */}
            <div className="mt-6 text-center">
              <h2 className="text-2xl font-semibold text-gray-900">Voice Assistant</h2>
              <p className="mt-2 text-sm text-gray-600">{getStatusText()}</p>
              {isCallActive && <p className="mt-1 text-xs font-mono text-gray-500">{formatDuration(callDuration)}</p>}
              {voiceConversationId && (
                <p className="mt-1 text-xs text-gray-400">Session: {voiceConversationId.slice(0, 8)}...</p>
              )}
            </div>
          </div>

          {/* Call Button */}
          <div className="flex justify-center items-center gap-4">
            {/* Mute Button - Only visible when call is active */}
            {isCallActive && (
              <Button
                size="lg"
                onClick={handleMuteToggle}
                className={`h-14 w-14 rounded-full transition-all duration-300 ${
                  isMicrophoneEnabled
                    ? "bg-gray-600 hover:bg-gray-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
            )}

            {/* Call Button */}
            <Button
              size="lg"
              onClick={handleCallToggle}
              disabled={status === "connecting"}
              className={`h-16 w-16 rounded-full transition-all duration-300 ${
                isCallActive ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isCallActive ? <PhoneOff className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      {showCamera && (
        <CameraCapture
          onCapture={handleImageCapture}
          onClose={() => setShowCamera(false)}
          instructions={cameraInstructions}
        />
      )}
    </>
  )
}
