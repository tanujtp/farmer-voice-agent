export async function livekitTokenApi({
    payload,
    headers,
  }: {
    payload: any
    headers: Record<string, string>
  }) {
    try {
      const response = await fetch("/api/audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      })
  
      const data = await response.json()
  
      return {
        status: response.status,
        data: data,
      }
    } catch (error) {
      console.error("[v0] Error fetching LiveKit token:", error)
      throw error
    }
  }