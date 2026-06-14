import { Resend } from "resend";
import { env } from "../config/env.ts";

const resend = new Resend(env.resendApiKey);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  try {
    const response = await resend.emails.send({
      from: "Chatson <noreply@chatson.my.id>",
      to,
      subject,
      html,
    });

    if (response.error) {
      throw new Error(`Resend error: ${response.error.message}`);
    }

    console.log(`[EMAIL] Sent to ${to}:`, response.data?.id);
  } catch (err) {
    console.error(`[EMAIL] Failed to send:`, err);
    throw err;
  }
}

export async function sendEscalationReply(
  userEmail: string,
  userName: string,
  originalQuestion: string,
  replyMessage: string
): Promise<void> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0A2A8B; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Balasan dari Tim Customer Service</h2>
      </div>
      
      <div style="padding: 20px; background-color: #f9f9f9; border: 1px solid #eee; border-radius: 0 0 8px 8px;">
        <p>Halo ${userName},</p>
        
        <p>Tim Customer Service kami telah menanggapi pertanyaan Anda:</p>
        
        <div style="background-color: white; padding: 15px; border-left: 4px solid #0A2A8B; margin: 15px 0;">
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;"><strong>Pertanyaan Anda:</strong></p>
          <p style="margin: 0; white-space: pre-wrap;">${originalQuestion}</p>
        </div>
        
        <div style="background-color: white; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0;">
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;"><strong>Balasan Tim:</strong></p>
          <p style="margin: 0; white-space: pre-wrap;">${replyMessage}</p>
        </div>
        
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Jika Anda memiliki pertanyaan lebih lanjut, silakan hubungi kami kembali melalui platform Chatson.
        </p>
        
        <p style="margin-top: 20px; color: #999; font-size: 12px; border-top: 1px solid #eee; padding-top: 15px;">
          © Epson Helpdesk | Powered by Chatson
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: userEmail,
    subject: "Balasan dari Tim Customer Service - Epson Helpdesk",
    html,
  });
}
