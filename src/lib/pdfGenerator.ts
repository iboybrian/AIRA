import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export interface PDFData {
  inspectorName: string;
  date: string;
  company: string;
  area: string;
  observation: string;
  analysisResponse: string;
  imageParts: Array<{ mimeType: string; data: string }>; // base64
}

export async function generatePDF(data: PDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers: Buffer[] = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });

      // Branding & Header
      const logoAira = path.join(process.cwd(), "public", "aira2.JPG");
      const logoPng = path.join(process.cwd(), "public", "logo.png");
      const logoJpg = path.join(process.cwd(), "public", "logo.jpg");
      
      let logoPath = null;
      if (fs.existsSync(logoAira)) logoPath = logoAira;
      else if (fs.existsSync(logoPng)) logoPath = logoPng;
      else if (fs.existsSync(logoJpg)) logoPath = logoJpg;

      if (logoPath) {
        doc.image(logoPath, { fit: [200, 120], align: "center" });
        doc.moveDown(1);
      } else {
        doc.fillColor("#0B2A5C").fontSize(24).text("AIRA", { align: "center" });
      }
      doc.fontSize(14).fillColor("#4CAF50").text("Reporte de Inspección de Seguridad", { align: "center" });
      doc.moveDown(2);

      // Metadata
      doc.fillColor("#000000").fontSize(12);
      doc.font("Helvetica-Bold").text("Inspector: ", { continued: true }).font("Helvetica").text(data.inspectorName);
      doc.font("Helvetica-Bold").text("Fecha y Hora: ", { continued: true }).font("Helvetica").text(data.date);
      doc.font("Helvetica-Bold").text("Empresa: ", { continued: true }).font("Helvetica").text(data.company);
      doc.font("Helvetica-Bold").text("Área Inspeccionada: ", { continued: true }).font("Helvetica").text(data.area);
      doc.moveDown();

      // Observation section
      doc.fontSize(14).fillColor("#0B2A5C").font("Helvetica-Bold").text("Observación en Campo");
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor("#333333").font("Helvetica").text(data.observation);
      doc.moveDown(2);

      // AI Analysis
      doc.addPage();
      doc.fontSize(16).fillColor("#0B2A5C").font("Helvetica-Bold").text("Análisis de Seguridad (OSHA)", { underline: true });
      doc.moveDown();
      
      const lines = data.analysisResponse.split("\n");
      for (let rawLine of lines) {
        // Replace typographic quotes/dashes and remove non-Latin-1 characters (emojis, etc.)
        let line = rawLine
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2013\u2014]/g, '-')
          .replace(/[^\x00-\xFF]/g, '');
        
        let cleanLine = line.trim();
        if (!cleanLine) {
          doc.moveDown(0.5);
          continue;
        }

        // Draw a solid line instead of "---"
        if (cleanLine.startsWith("---")) {
          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#CCCCCC").stroke();
          doc.moveDown(0.5);
          continue;
        }

        // Render table rows
        if (cleanLine.startsWith("|") && cleanLine.endsWith("|")) {
          // Salte filas separadoras
          if (cleanLine.replace(/[|\-\s]/g, "") === "") {
            continue;
          }
          const cells = cleanLine.split("|").slice(1, -1).map(c => c.trim());
          const colWidth = (doc.page.width - 100) / cells.length;
          const startY = doc.y;
          const rowHeight = 20;

          doc.font("Helvetica").fillColor("#333333").fontSize(10);
          for (let i = 0; i < cells.length; i++) {
            const cellX = 50 + i * colWidth;
            doc.rect(cellX, startY, colWidth, rowHeight).strokeColor("#CCCCCC").stroke();
            doc.text(cells[i], cellX + 5, startY + 5, { width: colWidth - 10, lineBreak: false });
          }
          doc.y = startY + rowHeight;
          doc.x = 50;
          continue;
        }

        // Handle Markdown headings and blockquotes
        let isHeader = false;
        if (cleanLine.startsWith("#")) {
          isHeader = true;
          cleanLine = cleanLine.replace(/^#+\s*/, '');
        } else if (cleanLine.startsWith(">")) {
          cleanLine = cleanLine.replace(/^>\s*/, '');
        }

        cleanLine = cleanLine.trim();
        if (!cleanLine) continue;

        let color = "#333333";
        let font = isHeader ? "Helvetica-Bold" : "Helvetica";
        let size = isHeader ? 13 : 11;
        
        if (cleanLine.includes("CRÍTICO")) {
          color = "#FF0000";
        } else if (cleanLine.includes("ALTO")) {
          color = "#FF6B35";
        } else if (cleanLine.includes("MEDIO")) {
          color = "#D97706";
        } else if (cleanLine.includes("BAJO")) {
          color = "#059669";
        } else if (isHeader) {
          color = "#0B2A5C";
        }

        // Handle **bold** text within the line
        const parts = cleanLine.split("**");
        if (parts.length === 1) {
          doc.fillColor(color).fontSize(size).font(font).text(parts[0]);
        } else {
          const validParts = parts.map((text, idx) => ({ text, isBold: idx % 2 !== 0 })).filter(p => p.text !== "");
          const lastIndex = validParts.length - 1;
          
          for (let i = 0; i < validParts.length; i++) {
            const p = validParts[i];
            const currentFont = p.isBold || font === "Helvetica-Bold" ? "Helvetica-Bold" : "Helvetica";
            doc.fillColor(color).fontSize(size).font(currentFont).text(p.text, { continued: i < lastIndex });
          }
          doc.moveDown(0.3);
        }
      }

      // Images Section
      if (data.imageParts.length > 0) {
        doc.addPage();
        doc.fontSize(16).fillColor("#0B2A5C").font("Helvetica-Bold").text("Evidencia Fotográfica", { align: "center" });
        doc.moveDown();
        
        for (let i = 0; i < data.imageParts.length; i++) {
          const img = data.imageParts[i];
          try {
            const imgBuffer = Buffer.from(img.data, "base64");
            // Add image scaled to fit width of 450
            doc.image(imgBuffer, { fit: [450, 300], align: "center" });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor("#666666").font("Helvetica").text(`Imagen ${i + 1}`, { align: "center" });
            doc.moveDown(2);
          } catch (e) {
            console.log("Error adding image to PDF:", e);
          }
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
