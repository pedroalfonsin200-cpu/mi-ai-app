import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query requerido" }, { status: 400 });
    }

    // DuckDuckGo Instant Answer API - gratis, sin registro
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const ddgData = await ddgRes.json();

    // Construye contexto a partir de los resultados
    let searchContext = "";
    if (ddgData.AbstractText) {
      searchContext += `Resumen: ${ddgData.AbstractText}\nFuente: ${ddgData.AbstractURL}\n\n`;
    }
    if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
      searchContext += "Resultados relacionados:\n";
      ddgData.RelatedTopics.slice(0, 5).forEach((topic: { Text?: string; FirstURL?: string }, i: number) => {
        if (topic.Text) {
          searchContext += `${i + 1}. ${topic.Text}\n`;
          if (topic.FirstURL) searchContext += `   ${topic.FirstURL}\n`;
        }
      });
    }

    if (!searchContext) {
      searchContext = "No se encontraron resultados específicos. Respondiendo con conocimiento general.";
    }

    // Usa Groq para resumir y responder
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `Eres Nova, una IA que responde preguntas usando información de búsqueda web.
Nunca menciones Groq, Llama, Meta, OpenAI ni ningún modelo externo.
Responde en español de forma clara y directa.
Si tienes información de la búsqueda, úsala y menciona las fuentes.
Si no hay información suficiente, usa tu conocimiento general y dilo.`,
        },
        {
          role: "user",
          content: `Pregunta del usuario: ${query}\n\nInformación encontrada en la web:\n${searchContext}\n\nResponde la pregunta usando esta información.`,
        },
      ],
      temperature: 0.5,
      max_tokens: 1024,
    });

    const answer = completion.choices[0]?.message?.content || "No pude procesar la búsqueda.";

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { answer: "Hubo un error con la búsqueda. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
