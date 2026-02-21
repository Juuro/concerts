import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ParsedConcertSearch {
  artist: string | null;
  city: string | null;
  venue: string | null;
  festival: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  season: "winter" | "spring" | "summer" | "fall" | null;
  month: number | null;
}

export async function parseConcertSearch(
  userInput: string
): Promise<ParsedConcertSearch> {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant", // Fast, free, good quality
    messages: [
      {
        role: "system",
        content: `You extract concert search parameters from natural language descriptions. 
Return valid JSON only with these fields (use null if not mentioned):
- artist: band/artist name
- city: city name
- venue: venue name
- festival: festival name
- yearStart: earliest possible year (number)
- yearEnd: latest possible year (number, same as yearStart if single year)
- season: "winter" | "spring" | "summer" | "fall"
- month: 1-12 if specific month mentioned`,
      },
      {
        role: "user",
        content: userInput,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0, // Deterministic output
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}
