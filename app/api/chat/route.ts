import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `Eres Nova, una IA avanzada creada por el equipo de Nova AI.
Eres inteligente, directa, útil y amigable.
Respondes en el idioma del usuario (español por defecto).
Nunca menciones Groq, Llama, Meta, OpenAI, ni ningún modelo de AI externo.
Si te preguntan quién te creó, dices que fuiste creada por el equipo de Nova AI.
Si te preguntan qué modelo eres, dices que eres Nova AI.

HERRAMIENTAS DISPONIBLES:
Tienes acceso a herramientas que debes usar automáticamente según el contexto:

1. generate_image: Úsala cuando el usuario quiera crear, generar, dibujar, hacer, o diseñar una imagen, foto, dibujo, ilustración, logo, etc.
   Ejemplos que la activan:
   - "créame una imagen de un dragón"
   - "haz un dibujo de un gato"
   - "genera una foto de..."
   - "quiero ver una ilustración de..."
   - "dibújame un..."
   Antes de llamarla, mejora el prompt del usuario con detalles visuales en inglés para mejor calidad.

2. search_web: Úsala cuando el usuario pregunta sobre eventos actuales, noticias, precios, datos recientes, o cosas que requieren información en tiempo real.
   Ejemplos:
   - "qué pasó hoy con..."
   - "cuál es el precio actual de..."
   - "últimas noticias de..."

Para conversación normal, chistes, código, explicaciones, consejos, etc. NO uses herramientas, solo responde directamente.

Tus respuestas son claras, bien estructuradas y al grano.
Usas markdown cuando ayuda a la claridad (listas, código, negritas).`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Genera una imagen a partir de una descripción. Úsala cuando el usuario pida crear, generar, dibujar o hacer una imagen, foto, dibujo o ilustración.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Descripción detallada de la imagen en inglés con estilo visual, iluminación, composición. Ejemplo: 'a majestic red dragon flying over snow mountains, cinematic lighting, highly detailed, 4k'",
          },
          description_for_user: {
            type: "string",
            description: "Breve descripción en el idioma del usuario de qué imagen se va a generar. Ejemplo: 'un dragón rojo volando sobre montañas nevadas'",
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
      description: "Busca información actual en la web. Úsala cuando necesites datos recientes, noticias, precios actuales, o eventos del momento.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "La consulta de búsqueda",
          },
        },
        required: ["query"],
      },
    },
  },
];

async function generateImage(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 100000);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true`;
}

async function searchWeb(query: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await res.json();
    let context = "";
    if (data.AbstractText) {
      context += `${data.AbstractText}\nFuente: ${data.AbstractURL}\n\n`;
    }
    if (data.RelatedTopics?.length > 0) {
      data.RelatedTopics.slice(0, 5).forEach((topic: { Text?: string; FirstURL?: string }, i: number) => {
        if (topic.Text) {
          context += `${i + 1}. ${topic.Text}\n`;
          if (topic.FirstURL) context += `   ${topic.FirstURL}\n`;
        }
      });
    }
    return context || "No se encontraron resultados específicos para esa búsqueda.";
  } catch {
    return "No se pudo completar la búsqueda web.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 2048,
    });

    const message = completion.choices[0]?.message;

    // Si llama a una herramienta
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
        // Segunda llamada con los resultados de búsqueda
        const followUp = await groq.chat.completions.create({
          model: "openai/gpt-oss-120b",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
            message,
            {
              role: "tool",
              content: searchResults,
              tool_call_id: toolCall.id,
            },
          ],
          temperature: 0.5,
          max_tokens: 1024,
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
