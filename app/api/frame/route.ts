import { NextRequest, NextResponse } from "next/server";

/**
 * OPTIMIZATION: Use the Edge Runtime.
 * This runs the function in the data center closest to the user,
 * significantly reducing latency compared to the standard Node.js runtime.
 */
export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { text, tone } = await req.json();

    // 1. Validation
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    /**
     * 2. Model Selection (Post-Deprecation)
     * gemini-2.5-flash is deprecated. gemini-3-flash-preview is the 
     * current high-speed replacement recommended by Google.
     */
   // Preview models MUST use v1beta to be found
const MODEL = "gemini-3-flash-preview";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`

    // 3. Optimized System Instructions
    // Keeping instructions short reduces "Time to First Token"
    let toneInstruction = "Rewrite the text clearly and concisely. Result only.";
    if (tone === "formal") {
      toneInstruction = "Rewrite the text in a professional, formal tone. Concise. Result only.";
    } else if (tone === "casual") {
      toneInstruction = "Rewrite the text in a casual, friendly tone. Natural. Result only.";
    } else if (tone === "lowercase") {
      toneInstruction = "Rewrite the text in all lowercase letters. Result only.";
    }

    // 4. API Request
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${toneInstruction}\n\nOriginal: "${text}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,   // Lower temperature = faster, more focused response
          maxOutputTokens: 256, // Prevents unnecessary long-form generation
          topP: 0.8,
          topK: 40,
        },
      }),
    });

    // 5. Error Handling
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData?.error?.message || "Gemini API Error" },
        { status: response.status }
      );
    }

    // 6. Response Parsing
    const data = await response.json();
    const framed = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    return NextResponse.json({ framed });

  } catch (error: any) {
    console.error("Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
} 
