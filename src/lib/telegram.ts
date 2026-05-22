export async function sendTelegramDocument(pdfBuffer: Buffer, caption: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn("Telegram bot token or chat ID not set. Skipping Telegram notification.");
    return;
  }

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("caption", caption);
  
  // Create a Blob from the Buffer
  const pdfBlob = new Blob([pdfBuffer as unknown as BlobPart], { type: "application/pdf" });
  formData.append("document", pdfBlob, "SafeCheck_Report.pdf");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Failed to send to Telegram:", errorText);
    } else {
      console.log("Successfully sent report to Telegram.");
    }
  } catch (error) {
    console.error("Error communicating with Telegram API:", error);
  }
}
