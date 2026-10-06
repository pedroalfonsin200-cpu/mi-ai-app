import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });
    }

    // Pollinations.ai - 100% gratis, sin API key
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 100000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image API error:", error);
    return NextResponse.json(
      { error: "Error generando imagen" },
      { status: 500 }
    );
  }
}
