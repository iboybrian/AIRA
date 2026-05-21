"use client";

import { useState, useRef, FormEvent } from "react";
import styles from "./page.module.css";
import { UploadCloud, X, Loader2, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImages((prev) => [...prev, ...filesArray]);
      
      filesArray.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImagePreviews(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResults(null);

    const formData = new FormData(e.currentTarget);
    images.forEach(img => formData.append("images", img));

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        setResults(data.analysis);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Error de conexión al enviar el reporte.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const renderResults = () => {
    if (!results) return null;
    
    let findingsText = results;
    let summaryText = "";

    // Safely separate the executive summary from the findings
    const summaryMatch = results.match(/RESUMEN EJECUTIVO|Resumen Ejecutivo|Resumen ejecutivo/i);
    if (summaryMatch && summaryMatch.index !== undefined) {
      findingsText = results.substring(0, summaryMatch.index);
      summaryText = results.substring(summaryMatch.index);
    }

    // Split the remaining text by --- to get individual findings
    const findings = findingsText.split('---')
      .map(s => s.trim())
      .filter(s => (s.includes('Hallazgo') || s.includes('Nivel de Riesgo')) && s.length > 20);

    const summaryBlock = summaryText.length > 0 ? summaryText : null;

    return (
      <div className={styles.resultsSection}>
        <div className={styles.resultsHeader}>
          <h2>Resultados de la Inspección</h2>
          <p className={styles.subtitle}>Análisis impulsado por IA basado en estándares OSHA</p>
        </div>

        {findings.map((finding, idx) => {
          const isCritical = finding.includes("CRÍTICO");
          const isHigh = finding.includes("ALTO");
          const isMedium = finding.includes("MEDIO");
          const isLow = finding.includes("BAJO");
          
          let riskClass = styles.low;
          let riskText = "BAJO";
          if (isCritical) { riskClass = styles.critical; riskText = "CRÍTICO"; }
          else if (isHigh) { riskClass = styles.high; riskText = "ALTO"; }
          else if (isMedium) { riskClass = styles.medium; riskText = "MEDIO"; }

          return (
            <div key={idx} className={`${styles.findingCard} ${riskClass}`}>
              <div className={styles.findingHeader}>
                <h3 className={styles.findingTitle}>Hallazgo #{idx + 1}</h3>
                <span className={`${styles.riskBadge} ${riskClass}`}>{riskText}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", color: "var(--text)" }}>
                {finding.replace(/🔍 Hallazgo #\d+\n?/, "").replace(/⚠️ Nivel de Riesgo:.*\n?/, "")}
              </div>
            </div>
          );
        })}

        {summaryBlock && (
          <div className={styles.executiveSummary}>
            <h3>Resumen Ejecutivo</h3>
            <div style={{ whiteSpace: "pre-wrap" }}>
               {summaryBlock.replace(/RESUMEN EJECUTIVO\n?/, "")}
            </div>
          </div>
        )}

        <div className={styles.successMessage}>
          <CheckCircle2 />
          <span>El reporte PDF ha sido generado y enviado automáticamente por Telegram.</span>
        </div>
      </div>
    );
  };

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const defaultDate = now.toISOString().slice(0, 16);

  return (
    <main className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>SafeCheck <span className={styles.titleHighlight}>AI</span></h1>
        <p className={styles.subtitle}>Inspección de Seguridad Industrial Inteligente</p>
      </div>

      <form className={styles.formCard} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Nombre del Inspector</label>
          <input type="text" name="inspectorName" required className={styles.input} placeholder="Ej. Juan Pérez" />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Fecha y Hora</label>
          <input type="datetime-local" name="date" required className={styles.input} defaultValue={defaultDate} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Empresa / Planta</label>
          <input type="text" name="company" required className={styles.input} placeholder="Nombre de la instalación" />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Área Inspeccionada</label>
          <input type="text" name="area" required className={styles.input} placeholder="Ej. Línea de ensamblaje B" />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Observaciones</label>
          <textarea 
            name="observation" 
            required 
            className={styles.textarea} 
            placeholder="Describe lo que ves, escuchas o notas en el área..."
          ></textarea>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Evidencia Fotográfica</label>
          <div 
            className={styles.imageUploadArea}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={32} className={styles.uploadIcon} />
            <p className={styles.uploadText}>Toca aquí para tomar una foto o subir imágenes</p>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className={styles.hiddenInput} 
              ref={fileInputRef}
              onChange={handleImageChange}
            />
          </div>

          {imagePreviews.length > 0 && (
            <div className={styles.imagePreviews}>
              {imagePreviews.map((src, idx) => (
                <div key={idx} className={styles.imagePreviewItem}>
                  <img src={src} alt="Preview" />
                  <button type="button" onClick={() => removeImage(idx)} className={styles.removeImageBtn}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={isSubmitting} className={styles.submitBtn}>
          {isSubmitting ? (
            <>
              <Loader2 className={styles.loader} />
              Analizando... esto puede tomar unos segundos
            </>
          ) : (
            "Analizar inspección"
          )}
        </button>
      </form>

      {renderResults()}
    </main>
  );
}
