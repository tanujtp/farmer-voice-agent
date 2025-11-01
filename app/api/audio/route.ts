export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { type NextRequest, NextResponse } from "next/server"


export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-PROJECT-ID, x-project-id",
      "Access-Control-Max-Age": "86400",
    },
  })
}

export async function POST(request: NextRequest) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-PROJECT-ID, x-project-id",
  }

  try {
    const body = await request.json()
    console.log("[v0] Token request body:", body)

    const agentDetailsResponse = await fetch("https://edge-service.simplai.ai/agent/agents/6904bc1b66c464d16068f10f", {
      method: "GET",
      headers: {
        "sec-ch-ua-platform": "macOS",
        "X-USER-ID": "72",
        "X-DEVICE-ID": "simplai",
        "PIM-SID": "7a337dda-93c7-4cba-84bd-c386ae608acf",
        "X-SELLER-PROFILE-ID": "72",
        "sec-ch-ua": '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
        "X-PROJECT-ID": "1331",
        "sec-ch-ua-mobile": "?0",
        Referer: "https://app.simplai.ai/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "X-SELLER-ID": "72",
        "X-CLIENT-ID": "72",
        "X-TENANT-ID": "11",
      },
    })

    let agentDetails = null
    if (agentDetailsResponse.ok) {
      agentDetails = await agentDetailsResponse.json()
      console.log("[v0] Agent details retrieved:", agentDetails)
    } else {
      console.error("[v0] Failed to get agent details:", agentDetailsResponse.status)
    }

    const requestPayload = {
      agent_details: {
        agent_name: agentDetails?.agent_name || "Sample_geneyse",
        agent_id: "6904bc1b66c464d16068f10f",
        version_id: "latest",
        citations: false,
        tool_citations: false,
        config: agentDetails?.config || {
          context_window_config: 1,
          context_window_config_details: {
            context_window_max_token: 0,
            context_window_config_strategy: 1,
            context_window_allocation_per: 0,
            context_window_store_tool_output: false,
            context_window_tool_output_size_config: null,
          },
          voice_agent_config: {
            agent_language: "en-US",
            tts: "Azure",
            stt: "Azure",
            speed: 1,
            voice: "en-US-JennyNeural",
            tts_language: "en-US",
            stt_language: "en-US",
            tts_model: null,
            detect_language: false,
            stt_model: null,
            pitch: null,
            rate: null,
            volume: null,
            allow_interruptions: true,
            interrupt_min_words: 0,
            interrupt_speech_duration: 0.5,
            min_endpointing_delay: 4,
          },
          voice_config: {
            enabled: true,
            is_avatar_enabled: false,
            language: "en-IN",
            transcriber_config: {
              transcriber: "AssemblyAI",
              time_cutoff_seconds: 1,
            },
            synthesizer_config: {
              synthesizer: "Azure",
              voice_name: "en-IN-NeerjaNeural",
            },
            conversation_config: {
              interrupt_sensitivity: "low",
              use_backchannels: false,
              backchannel_probability: 0.7,
              allowed_idle_time_seconds: 20,
              num_check_human_present_times: 0,
              allow_agent_to_be_cut_off: true,
              end_conversation_on_goodbye: false,
              initial_message_delay: 0,
              text_to_speech_chunk_size_seconds: 1,
              per_chunk_allowance_seconds: 0.01,
            },
            should_generate_new_message_for_voice: false,
            new_voice_message_prompt: null,
            should_speak_out_tool_calls: false,
          },
        },
      },
      conversation_details: {},
      user_details: {
        name: body.userName || "Peter Parker",
        id: 72,
        guest_user: false,
      },
    }

    console.log("[v0] Making request to external API with payload:", requestPayload)

    const tokenResponse = await fetch("https://edge-service.simplai.ai/agent/getToken", {
      method: "POST",
      headers: {
        accept: "application/json, text/plain, */*",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "content-type": "application/json",
        dnt: "1",
        origin: "https://app.simplai.ai",
        "pim-sid": "7a337dda-93c7-4cba-84bd-c386ae608acf",
        pragma: "no-cache",
        priority: "u=1, i",
        referer: "https://app.simplai.ai/",
        "sec-ch-ua": '"Not=A?Brand";v="24", "Chromium";v="140"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "macOS",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        "x-client-id": "72",
        "x-device-id": "simplai",
        "x-project-id": "1331",
        "x-seller-id": "72",
        "x-seller-profile-id": "72",
        "x-tenant-id": "11",
        "x-user-id": "72",
      },
      body: JSON.stringify(requestPayload),
    })

    console.log("[v0] External API response status:", tokenResponse.status)
    console.log("[v0] External API response headers:", Object.fromEntries(tokenResponse.headers.entries()))

    const tokenData = await tokenResponse.json()
    console.log("[v0] External API response data:", tokenData)

    if (tokenResponse.ok && tokenData.token) {
      console.log("[v0] Token generation successful")
      return NextResponse.json(
        {
          token: tokenData.token,
          conversation_id: tokenData.conversation_id,
        },
        {
          headers: corsHeaders,
        },
      )
    } else {
      console.error("[v0] External API returned error:", tokenData)
      const mockToken = `mock_token_${Date.now()}`
      const mockConversationId = `mock_conv_${Date.now()}`

      console.log("[v0] Using mock data for development")
      return NextResponse.json(
        {
          token: mockToken,
          conversation_id: mockConversationId,
          mock: true,
        },
        {
          headers: corsHeaders,
        },
      )
    }
  } catch (error) {
    console.error("[v0] Token generation error:", error)

    const mockToken = `mock_token_${Date.now()}`
    const mockConversationId = `mock_conv_${Date.now()}`

    console.log("[v0] Using mock data due to error")
    return NextResponse.json(
      {
        token: mockToken,
        conversation_id: mockConversationId,
        mock: true,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      {
        headers: corsHeaders,
      },
    )
  }
}
