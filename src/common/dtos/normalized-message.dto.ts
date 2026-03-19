export class AttachmentDto {
    file_id: string;
    url: string;
    type: string; // MIME
  }
  
  export class NormalizedMessageDto {
    user_id: string;        // Ej: teléfono o ID de FB
    channel: 'whatsapp' | 'messenger' | 'instagram';
    text: string;
    attachments: AttachmentDto[];
    timestamp: number;
  }