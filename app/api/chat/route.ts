import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase-server";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `Eres Ramoncito, una IA avanzada creada por el equipo de Ramoncito.

PERSONALIDAD:
- Inteligente, directo, cálido y curioso.
- Hablas con naturalidad, como una persona real, no como un robot.
- Tienes sentido del humor sutil cuando el contexto lo permite.
- Eres honesto cuando no sabes algo — nunca inventas.
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
- Si preguntan quién te creó: fuiste creado por el equipo de Ramoncito.
- Si preguntan qué modelo eres: eres Ramoncito.
- Si insisten sobre tu arquitectura: dices que eres una IA propietaria de Ramoncito.

HERRAMIENTAS:
1. generate_image → crear imágenes
   Mejora el prompt del usuario a inglés con detalles técnicos para mejor calidad.
2. search_web → buscar información actual
   SOLO para datos recientes, noticias, precios actuales, eventos.

ESTILO:
- Markdown cuando ayude.
- Idioma del usuario (español por defecto).
- Longitud proporcional a la pregunta.`;

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Genera una imagen a partir de una descripción detallada.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Descripción en INGLÉS con detalles visuales técnicos." },
          description_for_user: { type: "string", description: "Breve descripción en el idioma del usuario." },
        },
        required: ["prompt", "description_for_user"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_web",
      description: "Busca información actual en la web.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Consulta de búsqueda optimizada." },
        },
        required: ["query"],
      },
    },
  },
];

const LIMITS = {
  free: { messages: 20, images: 5 },
  pro: { messages: 500, images: 100 },
  ultra: { messages: 10000, images: 1000 },
};

async function generateImage(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 1000000);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux&enhance=true&nologo=true`;
}

async function searchWeb(query: string): Promise<string> {
  try {
    const ddgRes = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      }
    );
    const html = await ddgRes.text();
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
      const instantRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      );
      const instantData = await instantRes.json();
      if (instantData.AbstractText) {
        return `Resumen: ${instantData.AbstractText}\nFuente: ${instantData.AbstractURL}`;
      }
      return "No se encontraron resultados específicos.";
    }
    return `Resultados de búsqueda web para "${query}":\n\n${results.join("\n\n")}`;
  } catch (error) {
    console.error("Search error:", error);
    return "Error al buscar en la web.";
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, sessionId } = await req.json();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Rate limit check (solo para usuarios logueados)
    let profile = null;
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      profile = data;

      if (profile) {
        // Reset diario si pasó un día
        const today = new Date().toISOString().split("T")[0];
        if (profile.last_reset < today) {
          await supabase
            .from("profiles")
            .update({ messages_today: 0, images_today: 0, last_reset: today })
            .eq("id", user.id);
          profile.messages_today = 0;
          profile.images_today = 0;
        }

        const plan = profile.plan || "free";
        const limit = LIMITS[plan as keyof typeof LIMITS];
        if (profile.messages_today >= limit.messages) {
          return NextResponse.json({
            content: `Has alcanzado tu límite diario de ${limit.messages} mensajes del plan ${plan.toUpperCase()}. Vuelve mañana o considera upgradearte a un plan superior.`,
            limitReached: true,
          });
        }
      }
    }

    const completion = await groq.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 8192,
      top_p: 0.95,
    });

    const message = completion.choices[0]?.message;
    let responseContent = "";
    let responseImage: string | undefined = undefined;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);

      if (toolCall.function.name === "generate_image") {
        responseImage = await generateImage(args.prompt);
        responseContent = args.description_for_user || "Aquí está tu imagen:";
      } else if (toolCall.function.name === "search_web") {
        const searchResults = await searchWeb(args.query);
        const followUp = await groq.chat.completions.create({
          model: "moonshotai/kimi-k2-instruct",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + "\n\nAnaliza los resultados de búsqueda y responde con claridad, citando fuentes relevantes." },
            ...messages,
            message,
            { role: "tool", content: searchResults, tool_call_id: toolCall.id },
          ],
          temperature: 0.5,
          max_tokens: 4096,
        });
        responseContent = followUp.choices[0]?.message?.content || "No pude procesar la búsqueda.";
      }
    } else {
      responseContent = message?.content || "No pude generar una respuesta.";
    }

    // Guardar en DB si hay sesión
    if (user && sessionId) {
      const userMsg = messages[messages.length - 1];
      await supabase.from("messages").insert([
        { session_id: sessionId, role: "user", content: userMsg.content },
        { session_id: sessionId, role: "assistant", content: responseContent, image_url: responseImage },
      ]);
      await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      // Actualizar contadores
      await supabase
        .from("profiles")
        .update({
          messages_today: (profile?.messages_today || 0) + 1,
          images_today: (profile?.images_today || 0) + (responseImage ? 1 : 0),
        })
        .eq("id", user.id);
    }

    return NextResponse.json({
      content: responseContent,
      image: responseImage,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { content: "Hubo un error procesando tu mensaje. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
