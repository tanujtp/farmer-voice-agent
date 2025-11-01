import { VoiceMode } from "@/components/voice-mode"

export default function Home() {
  return (
    <VoiceMode
      agentDetails={{
        agent_id: "6904bc1b66c464d16068f10f",
        agent_name: "Voice Assistant",
        version_id: "latest",
        citations: false,
        tool_citations: false,
        config: {
          voice_config: {
            enabled: true,
            is_avatar_enabled: false,
            language: "en-US",
          },
        },
        socketEndpoint: "wss://lk.simplai.ai",
      }}
      userDetails={{
        name: "User",
        id: 72,
      }}
      projectId="1331"
    />
  )
}
