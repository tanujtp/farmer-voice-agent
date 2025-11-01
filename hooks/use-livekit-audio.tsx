"use client"

import { livekitTokenApi } from "@/utils/audio"
import { usePlan } from "@/providers/PlanProvider"
import { useAppStore } from "@/store"
import { __AGENT_SOCKET_ENDPOINT__ } from "@/utils/apiEndoints"
import { SIMD_WASM, WASM_URL, WORKLET_URL, X_PROJECT_ID } from "@/utils/constants"
import {
  checkPlanValidation,
  checkValidStringifiedJSON,
  getCleanMarkdownString,
  getErrorFromApi,
} from "@/utils/helperFunction"
import { createRoom } from "@/utils/livekit"
import { type DisconnectReason, type Participant, type Room, RoomEvent, Track } from "livekit-client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { v4 } from "uuid"
import useStore from "./useStore"

export type useLivekitAudioProps = {
  agentDetails: {
    agent_id: any
    agent_name?: any
    version_id?: any
    citations?: boolean
    tool_citations?: boolean
    config?: any
    socketEndpoint?: any
  }
  userDetails?: {
    name: string | undefined
    id: any
  }
  setMessages: (values: any) => void
  changeConversation: (values: any) => void
  conversationId?: any
  startSession?: any
  endSession?: any
  handleChunkSpeak?: any
  enableAgentThinkingMode?: any
  disableAgentThinkingMode?: any
  hasAvatar?: boolean
  projectId?: string | null
}

const useLivekitAudio = ({
  agentDetails,
  userDetails,
  setMessages,
  changeConversation,
  conversationId,
  startSession,
  endSession,
  handleChunkSpeak,
  enableAgentThinkingMode,
  disableAgentThinkingMode,
  hasAvatar,
  projectId,
}: useLivekitAudioProps) => {
  const textEncoder = useMemo(() => {
    return new TextEncoder()
  }, [])

  const decoder = useMemo(() => {
    return new TextDecoder()
  }, [])

  const session = {
    user: {
      id: "mock-user-id",
      name: "Mock User",
      email: "user@example.com",
    },
  }
  const store: any = useStore(useAppStore, (state) => state)
  const [conversationProjectId, setConversationProjectId] = useState(projectId)
  const { setShowUpgradePlanPrompt, setUpgradePlanPrompt } = usePlan()
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [status, setStatus] = useState<any>("idle")
  const [error, setError] = useState<string | null>(null)
  const [audioTracks, setAudioTracks] = useState<{
    [key: string]: Track | null
  }>({})
  const newConversationMessageAddedToChat = useRef(false)
  const [agentConnected, setAgentConnected] = useState(false)
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState<boolean>(true)
  const [voiceConversationId, setVoiceConversationId] = useState(conversationId)

  const remoteAudioRefs = useRef<{ [key: string]: HTMLAudioElement }>({})

  // ** NEW: Refs to manage audio context and RNNoise node for cleanup **
  const audioContextRef = useRef<AudioContext | null>(null)
  const rnnoiseNodeRef = useRef<RnnoiseWorkletNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!room) return

    const localParticipant = room.localParticipant

    // Handler to update the microphone state
    const handleMicrophoneStateChange = () => {
      setIsMicrophoneEnabled(localParticipant.isMicrophoneEnabled)
    }

    // Add event listeners
    localParticipant.on(RoomEvent.TrackMuted, handleMicrophoneStateChange)
    localParticipant.on(RoomEvent.TrackUnmuted, handleMicrophoneStateChange)

    return () => {
      // Cleanup event listeners when room or component unmounts
      localParticipant.off(RoomEvent.TrackMuted, handleMicrophoneStateChange)
      localParticipant.off(RoomEvent.TrackUnmuted, handleMicrophoneStateChange)
    }
  }, [room])

  useEffect(() => {
    if (participants?.length > 0) {
      const hasAgentParticipant = participants?.some((participant: any) => participant.isAgent)
      if (hasAgentParticipant) {
        setStatus("connected")
        setAgentConnected(true)
      }
    }
  }, [participants])

  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect()
      }
    }
  }, [room])

  const handleDisconnect = useCallback(() => {
    if (room) {
      room.disconnect()
    }
  }, [room])

  const interuptAgent = useCallback(() => {
    if (room) {
      const interuptMessage = textEncoder.encode("interupt_agent")
      room.localParticipant.publishData(interuptMessage, {
        topic: "agent_communication",
      })
    }
  }, [room, textEncoder])

  // Mute or Unmute Local Participant
  const toggleMuteLocalParticipant = (isMuted: boolean) => {
    if (room) {
    console.log("mute triggered")
      const localParticipant = room.localParticipant
      localParticipant.setMicrophoneEnabled(!isMuted)
    }
  }

  const connectToRoom = async () => {
    try {
      setStatus("connecting")
      setError(null)
      const payload = {
        agent_details: {
          agent_name: agentDetails?.agent_name,
          agent_id: agentDetails?.agent_id,
          version_id: agentDetails?.version_id,
          citations: agentDetails?.citations,
          tool_citations: agentDetails?.tool_citations,
          config: agentDetails?.config,
        },
        conversation_details: {
          conversation_id: voiceConversationId,
        },
        user_details: {
          name: userDetails?.name,
          id: userDetails?.id,
          guest_user: false,
        },
      }
      const livekitTokenResponse = await livekitTokenApi({
        payload,
        headers: { [X_PROJECT_ID]: conversationProjectId },
      })

      console.log("livekitTokenResponse",livekitTokenResponse)

      if (livekitTokenResponse?.status === 200) {
        if (voiceConversationId !== livekitTokenResponse?.data?.conversation_id) {
          setVoiceConversationId(livekitTokenResponse?.data?.conversation_id)
          changeConversation(livekitTokenResponse?.data?.conversation_id)
        }
        const newRoom = createRoom()

        newRoom
          .on(RoomEvent.Connected, () => {
            if (hasAvatar && startSession) startSession()
          })
          ?.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
            setStatus("idle")
            setAgentConnected(false)
            setParticipants([])
            setAudioTracks({})
            setRoom(null)
            setIsMicrophoneEnabled(true)
            newConversationMessageAddedToChat.current = false
            if (hasAvatar && endSession) endSession()

            // RNNOISE CLEANUP
            rnnoiseNodeRef.current?.destroy()
            audioContextRef.current?.close()
            micStreamRef.current?.getTracks().forEach((t) => t.stop())
            rnnoiseNodeRef.current = null
            audioContextRef.current = null
            micStreamRef.current = null
          })
          ?.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {})
          ?.on(RoomEvent.LocalAudioSilenceDetected, (publication) => {})
          ?.on(RoomEvent.LocalTrackSubscribed, (publication, participant) => {})
          ?.on(RoomEvent.TrackMuted, (publication, participant) => {})
          ?.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {})
          ?.on(RoomEvent.ConnectionStateChanged, (state) => {})
          ?.on(RoomEvent.EncryptionError, (error) => {})
          ?.on(RoomEvent.ParticipantPermissionsChanged, (prevPermissions, participant) => {})
          ?.on(RoomEvent.MediaDevicesError, (error) => {
            setError(getErrorFromApi(error))
            newRoom.disconnect()
          })
          ?.on(RoomEvent.DataReceived, (data, participant, kind, topic) => {
            const decodedData = decoder?.decode?.(data)

            const parsedTranscriptObject = JSON.parse(decodedData || JSON.stringify({}))

            parsedTranscriptObject?.segments?.map((currentTranscript: any) => {
              const newTextObj = JSON.parse(currentTranscript?.text || JSON.stringify({}))

              if (newTextObj?.role == "assistant" && !!newTextObj?.tool_calls) {
                setMessages((messages: any) => {
                  const latestMessage = messages[messages.length - 1]

                  const newTools =
                    newTextObj?.tool_calls
                      ?.map?.((toolData: any) => {
                        if (Object.keys(toolData || {})?.length > 0) {
                          const functionDetails = toolData?.function || {}

                          // check if the functionDetails?.name is equals to capturing_image if yes then open a camera and allow the user to click an image and when the users click the image allow them to send this image to this livekit room using the same method that interruptAgent function is using but to a different channel then it is using
                          return {
                            ...(toolData || {}),
                            ...(functionDetails || {}),
                          }
                        } else {
                          return null
                        }
                      })
                      ?.filter?.((toolData: any) => !!toolData) || null
                  newConversationMessageAddedToChat.current = true
                  if (latestMessage?.role === "SimplAi") {
                    return [...messages.slice(0, -1), { ...latestMessage, tools: newTools }]
                  }
                  return [
                    ...messages,
                    {
                      role: "SimplAi",
                      content: "",
                      tools: newTools,
                      id: v4(),
                    },
                  ]
                })
              } else if (newTextObj?.role == "tool" && !!newTextObj?.tool_call_id) {
                setMessages((messages: any) => {
                  const latestMessage = messages[messages.length - 1]

                  if (latestMessage?.role === "SimplAi") {
                    const newToolwithDetails = latestMessage?.tools
                      ? latestMessage?.tools?.map?.((toolData: any) => {
                          if (toolData?.id === newTextObj?.tool_call_id) {
                            return {
                              ...toolData,
                              content: `${toolData?.content || ""}${newTextObj?.content || ""}`,
                            }
                          } else {
                            return { ...toolData }
                          }
                        })
                      : null
                    return [...messages.slice(0, -1), { ...latestMessage, tools: newToolwithDetails }]
                  }

                  return [...messages]
                })
              } else if (newTextObj?.role == "tool" && !!newTextObj?.tool_call_id) {
                setMessages((messages: any) => {
                  const latestMessage = messages[messages.length - 1]

                  if (latestMessage?.role === "SimplAi") {
                    const newToolwithDetails = latestMessage?.tools
                      ? latestMessage?.tools?.map?.((toolData: any) => {
                          if (toolData?.id === newTextObj?.tool_call_id) {
                            return {
                              ...toolData,
                              content: `${toolData?.content || ""}${newTextObj?.content || ""}`,
                            }
                          } else {
                            return { ...toolData }
                          }
                        })
                      : null
                    return [...messages.slice(0, -1), { ...latestMessage, tools: newToolwithDetails }]
                  }

                  return [...messages]
                })
              } else if (newTextObj?.role == "assistant" && !!newTextObj?.citations) {
                setMessages((messages: any) => {
                  const latestMessage = messages[messages.length - 1]

                  if (latestMessage?.role === "SimplAi") {
                    const citations = { ...(latestMessage?.citations || {}) }
                    if (newTextObj?.citations?.nodes) {
                      newTextObj?.citations?.nodes?.forEach?.((citationChunk: any) => {
                        const fileName = citationChunk?.metadata?.file_name || citationChunk?.metadata?.filename
                        if (fileName) {
                          citations[fileName] = citations[fileName]
                            ? [...citations[fileName], citationChunk]
                            : [citationChunk]
                        }
                      })
                    } else if (Array.isArray(newTextObj?.citations) && newTextObj?.citations?.length > 0) {
                      newTextObj?.citations?.forEach((citationChunk: any) => {
                        const fileName = citationChunk?.doc?.file_name || citationChunk?.doc?.filename
                        if (fileName) {
                          citations[fileName] = citations[fileName]
                            ? [...citations[fileName], citationChunk]
                            : [citationChunk]
                        }
                      })
                    }
                    return [
                      ...messages.slice(0, -1),
                      {
                        ...latestMessage,
                        citations: Object.keys(citations).length > 0 ? citations : null,
                      },
                    ]
                  }

                  return [...messages]
                })
              } else if (newTextObj?.role == "assistant" || newTextObj?.role == "user") {
                if (handleChunkSpeak && newTextObj?.role == "assistant" && newTextObj?.media_type === "avatar_voice") {
                  // disableAgentThinkingMode();
                  handleChunkSpeak(getCleanMarkdownString(newTextObj?.content))
                  return null
                }
                //  else {
                //   enableAgentThinkingMode();
                // }
                setMessages((messages: any) => {
                  const latestMessage = messages[messages.length - 1]

                  if (!!!newConversationMessageAddedToChat?.current) {
                    newConversationMessageAddedToChat.current = true
                    return [
                      ...messages,
                      {
                        role: newTextObj?.role == "user" ? "user" : "SimplAi",
                        content: newTextObj?.content,
                        id: v4(),
                      },
                    ]
                  }
                  if (newTextObj?.role == "user") {
                    if (latestMessage?.role === "user") {
                      return [
                        ...messages.slice(0, -1),
                        {
                          ...latestMessage,
                          content: `${latestMessage?.content}${newTextObj?.content}`,
                        },
                      ]
                    } else {
                      return [
                        ...messages,
                        {
                          role: "user",
                          content: newTextObj?.content,
                          id: v4(),
                        },
                      ]
                    }
                  } else {
                    if (latestMessage?.role === "user") {
                      return [
                        ...messages,
                        {
                          role: "SimplAi",
                          content: newTextObj?.content,
                          id: v4(),
                        },
                      ]
                    } else {
                      return [
                        ...messages.slice(0, -1),
                        {
                          ...latestMessage,
                          content: `${latestMessage?.content}${newTextObj?.content}`,
                        },
                      ]
                    }
                  }
                })
              } else if (newTextObj?.role == "trace") {
                const trace = checkValidStringifiedJSON(newTextObj?.content)
                  ? JSON.parse(newTextObj?.content ?? JSON.stringify(""))
                  : {}
                setMessages((messages: any) => {
                  const latestMessage = messages[messages.length - 1]

                  if (latestMessage?.role === "SimplAi") {
                    return [...messages.slice(0, -1), { ...latestMessage, trace: trace }]
                  }

                  return [
                    ...messages,
                    {
                      role: "SimplAi",
                      content: "",
                      trace: trace,
                      id: v4(),
                    },
                  ]
                })
              }
            })
          })
          ?.on(RoomEvent.SignalConnected, () => {})
          ?.on(RoomEvent.ParticipantConnected, (participant: Participant) => {
            if (participant?.isAgent) {
              setStatus("connected")
              setAgentConnected(true)
            }
            setParticipants((prev) => [...prev, participant])

            // Subscribe to the participant's audio track
            // subscribeToAudioTrack(participant);
          })
          ?.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
            if (participant?.isAgent) {
              setAgentConnected(false)
              newRoom.disconnect()
              return null
            }
            setParticipants((prev) => prev.filter((p) => p !== participant))
            setAudioTracks((prev) => {
              const updatedTracks = { ...prev }
              delete updatedTracks[participant.identity]
              return updatedTracks
            })
          })
          ?.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
            // Add audio tracks of current user for visualization
            if (publication?.track?.kind === Track.Kind.Audio) {
              
              // Set the track for visualization
              setAudioTracks((prev) => ({
                ...prev,
                [participant.identity]: publication?.track || null, // Ensure no `undefined`
              }))
            }
          })
          ?.on(RoomEvent.TrackSubscribed, (track, publication, participant: Participant) => {
            // Ensure you update participants on any subscription changes
            if (track.kind === Track.Kind.Audio) {

            console.log("new audio came in")
                const audioElement = new Audio()
                audioElement.srcObject = new MediaStream([track.mediaStreamTrack])
                audioElement.play()
                remoteAudioRefs.current[participant.identity] = audioElement

              // Set the track for visualization
              setAudioTracks((prev) => ({
                ...prev,
                [participant.identity]: track || null, // Ensure no `undefined`
              }))
            }
          })
          ?.on(RoomEvent.TrackUnsubscribed, (_, __, participant: Participant) => {
            if (remoteAudioRefs.current[participant.identity]) {
              remoteAudioRefs.current[participant.identity].pause()
              delete remoteAudioRefs.current[participant.identity]
            }
            setAudioTracks((prev) => ({
              ...prev,
              [participant.identity]: null, // Explicitly set null when unsubscribed
            }))
          })
          ?.on(RoomEvent.TranscriptionReceived, (transcription, participant, publication) => {})

        await newRoom.connect(
          agentDetails?.socketEndpoint ?? __AGENT_SOCKET_ENDPOINT__,
          livekitTokenResponse?.data?.token,
          { autoSubscribe: true },
        )
        setRoom(newRoom)

          const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: false,
          channelCount: 1,
        },
      })

      micStreamRef.current = mediaStream

      // Publish audio track
      const audioTrack = mediaStream.getAudioTracks()[0]
      await newRoom.localParticipant.publishTrack(audioTrack, {
        name: "microphone",
        source: Track.Source.Microphone,
      })

      const allParticipants = [newRoom.localParticipant, ...Array.from(newRoom.remoteParticipants.values())]

        setParticipants(allParticipants)
      } else {
      console.log("error occured",  getErrorFromApi(error))
        const isPlanValid = checkPlanValidation(error, store, session, setShowUpgradePlanPrompt, setUpgradePlanPrompt)
        setError(getErrorFromApi(livekitTokenResponse))
        setStatus("error")
      }
    } catch (error) {
    console.log("error occured",  getErrorFromApi(error))
      const isPlanValid = checkPlanValidation(error, store, session, setShowUpgradePlanPrompt, setUpgradePlanPrompt)
      setError(getErrorFromApi(error))
      setStatus("error")
    }
  }

  return {
    status,
    room,
    participants,
    error,
    audioTracks,
    agentConnected,
    isMicrophoneEnabled,
    setError,
    connectToRoom,
    handleDisconnect,
    interuptAgent,
    toggleMuteLocalParticipant,
    setVoiceConversationId,
    voiceConversationId,
    conversationProjectId,
    setConversationProjectId,
  }
}

export default useLivekitAudio
