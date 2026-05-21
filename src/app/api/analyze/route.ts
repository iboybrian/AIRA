import { NextRequest, NextResponse } from "next/server";
import { generateSafetyReport } from "@/lib/ai/provider";
import { generatePDF } from "@/lib/pdfGenerator";
import { sendTelegramDocument } from "@/lib/telegram";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const inspectorName = formData.get("inspectorName") as string;
    const date = formData.get("date") as string;
    const company = formData.get("company") as string;
    const area = formData.get("area") as string;
    const observation = formData.get("observation") as string;
    const images = formData.getAll("images") as File[];

    if (!inspectorName || !company || !area || !observation) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    const imageParts = [];
    for (const file of images) {
      const buffer = Buffer.from(await file.arrayBuffer());
      imageParts.push({
        mimeType: file.type,
        data: buffer.toString("base64")
      });
    }

    const systemPrompt = `Eres un experto en seguridad industrial con amplio conocimiento de los estándares OSHA (Occupational Safety and Health Administration). Tu función es analizar reportes de inspección de seguridad enviados por inspectores junior en entornos industriales de cualquier sector.

Recibirás:
- Una descripción textual de lo que el inspector observó en campo.
- Una o más imágenes del área o situación inspeccionada.

Tu tarea es:

1. IDENTIFICAR todos los peligros o incumplimientos de seguridad presentes en la descripción y/o imágenes.

2. CLASIFICAR cada hallazgo según su nivel de riesgo:
   - 🔴 CRÍTICO — Riesgo inmediato de muerte o lesión grave. Requiere acción inmediata.
   - 🟠 ALTO — Riesgo significativo. Debe corregirse en el corto plazo.
   - 🟡 MEDIO — Riesgo moderado. Requiere atención y seguimiento.
   - 🟢 BAJO — Riesgo menor o incumplimiento administrativo.

3. REFERENCIAR el estándar OSHA aplicable a cada hallazgo (ej. OSHA 29 CFR 1910.132 para EPP).

4. PROPONER para cada hallazgo entre 1 y 2 acciones correctivas concretas y realizables.

Formato de respuesta — responde SIEMPRE con esta estructura para cada hallazgo:

---
🔍 Hallazgo #[N]
📌 Descripción: [Qué se identificó]
⚠️ Nivel de Riesgo: [CRÍTICO / ALTO / MEDIO / BAJO]
📋 Norma OSHA aplicable: [Código y descripción breve]
✅ Acciones correctivas:
  1. [Primera acción]
  2. [Segunda acción, si aplica]
---

Al final, incluye un RESUMEN EJECUTIVO con:
- Total de hallazgos por nivel de riesgo
- Observación general del estado de seguridad del área
- Recomendación prioritaria

Tono: profesional, claro y directo. Evita tecnicismos innecesarios y sé específico en las acciones.`;

    const analysisResponse = await generateSafetyReport(
      systemPrompt,
      observation,
      imageParts
    );

    // Generate PDF and send to Telegram asynchronously
    generatePDF({
      inspectorName,
      date,
      company,
      area,
      observation,
      analysisResponse,
      imageParts
    }).then((pdfBuffer) => {
      sendTelegramDocument(pdfBuffer, `📋 Nuevo reporte de inspección generado — ${company} | ${area} | ${date}`);
    }).catch((e) => {
      console.error("Error generating or sending PDF:", e);
    });

    return NextResponse.json({ success: true, analysis: analysisResponse });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al procesar la inspección: " + error.message },
      { status: 500 }
    );
  }
}
