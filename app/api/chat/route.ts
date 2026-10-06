import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// SYSTEM PROMPT V2 — más inteligente, con razonamiento y personalidad
const SYSTEM_PROMPT = `Eres Nova, una IA avanzada creada por el equipo de Nova AI.

PERSONALIDAD:
- Inteligente, directa, cálida y curiosa.
- Hablas con naturalidad, como una persona real, no como un robot.
- Tienes sentido del humor sutil cuando el contexto lo permite.
- Eres honesta cuando no sabes algo — nunca inventas.
- Tratas al usuario como un adulto capaz, sin condescendencia.

RAZONAMIENTO:
Antes de responder preguntas complejas, piensa paso a paso:
1. ¿Qué me están preguntando realmente?
2. ¿Qué información necesito?
3. ¿Qué pasos lleva la respuesta correcta?
4. Verifica tu lógica antes de dar la respuesta final.

Para preguntas simples, responde directo sin sobre-pensar.

IDENTIDAD:
- Nunca menciones Groq, Llama, Meta, OpenAI, Anthropic, Kimi, Moonshot, ni ningún modelo externo.
- Si preguntan quién te creó: fuiste creada por el equipo de Nova AI.
- Si preguntan qué modelo eres: eres Nova AI.
- Si insisten sobre tu arquitectura: dices que eres una IA propietaria de Nova AI, diseñada para ser útil y precisa.

HERRAMIENTAS:
Tienes acceso a herramientas que debes usar automáticamente:

1. generate_image → crear imágenes
   Actívala si el usuario pide: crear/generar/hacer/dibujar/diseñar una imagen, foto, dibujo, ilustración, logo, poster, etc.
   Mejora el prompt del usuario traduciéndolo a inglés con detalles visuales técnicos (iluminación, estilo, composición, 4K, etc.) para mejor calidad.

2. search_web → buscar información actual
   Actívala para: eventos recientes, noticias, precios actuales, resultados deportivos, clima, personas públicas actuales, cualquier cosa posterior a tu entrenamiento.
   NO la uses para conocimiento general, código, matemáticas, explicaciones conceptuales.

ESTILO DE RESPUESTA:
- Usa markdown cuando ayude: **negritas** para énfasis, listas para pasos, código en bloques.
- Responde en el idioma del usuario (español por defecto).
- Longitud proporcional a la pregunta: respuestas cortas para preguntas simples, respuestas completas para preguntas complejas.
- Si una respuesta tiene varios temas, estructúrala con headers o numeración.
- Cuando des código, siempre incluye comentarios en español explicando lo clave.
- Al final de respuestas técnicas largas, ofrece "¿quieres que profundice en algo?" solo si tiene sentido.

CUANDO NO SEPAS:
- Dilo claro: "no estoy segura" o "no tengo esa información".
- Ofrece buscar en la web si aplica.
- Nunca inventes datos, nombres, fechas, cifras.`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Genera una imagen a partir de una descripción detallada. Úsala cuando el usuario quiera crear, generar, dibujar, hacer o diseñar una imagen, foto, ilustración, logo o cualquier contenido visual.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Descripción detallada en INGLÉS con estilo visual, iluminación, composición y calidad. Ejemplo: 'a majestic red dragon soaring over snow-capped mountains at sunset, cinematic lighting, highly detailed, photorealistic, 4K, dramatic composition'",
          },
          description_for_user: {
            type: "string",
            description: "Breve descripción en el idioma del usuario de qué imagen se va a generar.",
          },
        },
        required: ["prompt", "description_for_user"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_web",
      description: "Busca información actual en la web. Úsala SOLO para datos recientes, noticias, precios, eventos actuales, personas actuales, resultados deportivos, clima.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Consulta de búsqueda optimizada en el idioma más probable para encontrar resultados (inglés para temas internacionales, español para temas locales).",
          },
        },
        required: ["query"],
      },
    },
  },
];

async function generateImage(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  // Pollinations con mejor calidad: modelo flux, enhanced
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux&enhance=true&nologo=true`;
}

async function searchWeb(query: string): Promise<string> {
  try {
    // DuckDuckGo HTML scraping da mejores resultados que la Instant API
    const ddgRes = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );
    const html = await ddgRes.text();

    // Parse básico de resultados
    const results: string[] = [];
    const regex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;
    let match;
    let count = 0;
    while ((match = regex.exec(html)) && count < 8) {
      const url = match[1].replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/, "").split("&")[0];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const snippet = match[3].replace(/<[^>]+>/g, "").trim();
      try {
        const decodedUrl = decodeURIComponent(url);
        results.push(`[${count + 1}] ${title}\n${snippet}\nFuente: ${decodedUrl}`);
      } catch {
        results.push(`[${count + 1}] ${title}\n${snippet}`);
      }
      count++;
    }

    if (results.length === 0) {
      // Fallback a la Instant Answer API
      const instantRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );
      const instantData = await instantRes.json();
      if (instantData.AbstractText) {
        return `Resumen: ${instantData.AbstractText}\nFuente: ${instantData.AbstractURL}`;
      }
      return "No se encontraron resultados específicos para esa búsqueda. Intenta reformular la pregunta.";
    }

    return `Resultados de búsqueda web para "${query}":\n\n${results.join("\n\n")}`;
  } catch (error) {
    console.error("Search error:", error);
    return "Error al buscar en la web. Responde con tu conocimiento general y aclara que no pudiste verificar.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const completion = await groq.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 8192,  // 4x más que antes
      top_p: 0.95,
    });

    const message = completion.choices[0]?.message;

    // Tool call: imagen o búsqueda web
    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === "generate_image") {
        const imageUrl = await generateImage(args.prompt);
        return NextResponse.json({
          content: args.description_for_user || "Aquí está tu imagen:",
          image: imageUrl,
        });
      }

      if (toolCall.function.name === "search_web") {
        const searchResults = await searchWeb(args.query);

        // Segunda pasada: la AI lee los resultados y responde con razonamiento
        const followUp = await groq.chat.completions.create({
          model: "moonshotai/kimi-k2-instruct",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + `\n\nAcabas de buscar en la web. Analiza los resultados, extrae la información relevante y responde la pregunta del usuario de forma clara y precisa. Cita las fuentes cuando sea útil.` },
            ...messages,
            message,
            {
              role: "tool",
              content: searchResults,
              tool_call_id: toolCall.id,
            },
          ],
          temperature: 0.5,
          max_tokens: 4096,
        });

        return NextResponse.json({
          content: followUp.choices[0]?.message?.content || "No pude procesar la búsqueda.",
        });
      }
    }

    return NextResponse.json({
      content: message?.content || "No pude generar una respuesta.",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { content: "Hubo un error procesando tu mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
