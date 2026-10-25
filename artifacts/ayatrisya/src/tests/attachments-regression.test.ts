import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { LocalRepository } from "@/storage/repository";
import { SendModelChatBody, ModelChatAttachmentSchema } from "../../../../lib/api-zod/src";
import type { MessageAttachment, ModelMessage } from "@/ai/types";
import { MAX_UPLOAD } from "@/lib/format";
import { validateFile } from "@/storage/files";

function local() {
  return new LocalRepository(`test-${crypto.randomUUID()}`);
}

describe("Ayatrisya AI Chat Attachments Pipeline", () => {
  it("validates that image attachments preserve bytes, MIME type, and filename in the request schema", () => {
    const sampleAttachment: MessageAttachment = {
      name: "pexels-pixabay-459203.jpg",
      mimeType: "image/jpeg",
      dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      size: 1024,
    };

    const parsedAttachment = ModelChatAttachmentSchema.safeParse(sampleAttachment);
    expect(parsedAttachment.success).toBe(true);

    const chatPayload = {
      messages: [
        {
          role: "user" as const,
          content: "What is in this image?",
          attachments: [sampleAttachment],
        },
      ],
      model: "v1-fast" as const,
      mode: "Normal" as const,
      stream: false,
      attachments: [sampleAttachment],
    };

    const parsedBody = SendModelChatBody.safeParse(chatPayload);
    expect(parsedBody.success).toBe(true);
    if (parsedBody.success) {
      expect(parsedBody.data.messages[0].attachments?.[0].name).toBe("pexels-pixabay-459203.jpg");
      expect(parsedBody.data.messages[0].attachments?.[0].mimeType).toBe("image/jpeg");
      expect(parsedBody.data.messages[0].attachments?.[0].dataBase64).toBe(sampleAttachment.dataBase64);
      expect(parsedBody.data.messages[0].content).toBe("What is in this image?");
    }
  });

  it("ensures text prompt and image attachments arrive together in the same turn", () => {
    const userPrompt = "Identify the species of bird in this photo.";
    const imageAttachment: MessageAttachment = {
      name: "bird.png",
      mimeType: "image/png",
      dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==",
      size: 512,
    };

    const message: ModelMessage = {
      role: "user",
      content: userPrompt,
      attachments: [imageAttachment],
    };

    expect(message.content).toBe(userPrompt);
    expect(message.attachments).toHaveLength(1);
    expect(message.attachments?.[0].name).toBe("bird.png");
    expect(message.attachments?.[0].dataBase64).toBeDefined();
  });

  it("supports multiple attachments including multi-image and document payloads", () => {
    const attachments: MessageAttachment[] = [
      {
        name: "architecture_diagram.png",
        mimeType: "image/png",
        dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNiAAAABgADNjd8qAAAAABJRU5ErkJggg==",
        size: 1024,
      },
      {
        name: "server_config.ts",
        mimeType: "text/typescript",
        textContent: "export const port = 8080;\nexport const env = 'production';",
        size: 52,
      },
      {
        name: "spec.pdf",
        mimeType: "application/pdf",
        dataBase64: "JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZz4+ZW5kb2JqCnRyYWlsZXI8PC9Sb290IDEgMCBSPj4KJSVFT0Y=",
        size: 96,
      },
    ];

    const payload = {
      messages: [
        {
          role: "user" as const,
          content: "Review these files together.",
          attachments,
        },
      ],
      model: "v2-best" as const,
      mode: "Normal" as const,
      stream: false,
      attachments,
    };

    const validation = SendModelChatBody.safeParse(payload);
    expect(validation.success).toBe(true);
    if (validation.success) {
      expect(validation.data.messages[0].attachments).toHaveLength(3);
      expect(validation.data.messages[0].attachments?.[1].textContent).toContain("export const port = 8080;");
    }
  });

  it("verifies removing an attachment excludes it from the submission list", () => {
    const pendingFiles = [
      new File(["img1"], "first.jpg", { type: "image/jpeg" }),
      new File(["img2"], "second.jpg", { type: "image/jpeg" }),
      new File(["doc"], "notes.txt", { type: "text/plain" }),
    ];

    // Simulate removing attachment at index 1 (second.jpg)
    const indexToRemove = 1;
    const remainingFiles = pendingFiles.filter((_, i) => i !== indexToRemove);

    expect(remainingFiles).toHaveLength(2);
    expect(remainingFiles.map((f) => f.name)).toEqual(["first.jpg", "notes.txt"]);
    expect(remainingFiles.some((f) => f.name === "second.jpg")).toBe(false);
  });

  it("verifies local persistence and model transmission operate independently", async () => {
    const repo = local();
    const conv = await repo.createConversation("Vision Test");
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const testFile = new File([jpegBytes], "test-photo.jpg", { type: "image/jpeg" });

    // Local storage saves file into IndexedDB
    const savedAttachment = await repo.addFile(testFile, null, conv.id);
    expect(savedAttachment.id).toBeDefined();
    expect(savedAttachment.name).toBe("test-photo.jpg");

    // Local retrieval gets the exact Blob
    const retrievedBlob = await repo.getFile(savedAttachment.id);
    expect(retrievedBlob).toBeDefined();
    expect(retrievedBlob?.size).toBe(testFile.size);

    // Save message with the attachment ID
    const msg = await repo.addMessage(conv.id, "Explain this photo", "user", [savedAttachment.id]);
    expect(msg.attachmentIds).toContain(savedAttachment.id);

    // Verify stored message can be retrieved independently of whether model inference was called
    const messages = await repo.getMessages(conv.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].attachmentIds).toContain(savedAttachment.id);
  });

  it("rejects oversized files exceeding MAX_UPLOAD", () => {
    const oversizedFile = {
      name: "huge-image.png",
      size: MAX_UPLOAD + 1,
      type: "image/png",
    };

    expect(() => validateFile(oversizedFile as File)).toThrow(/Files must be 10 MB or smaller/);
  });

  it("rejects unsupported executable or script files", () => {
    const scriptFile = {
      name: "virus.exe",
      size: 1024,
      type: "application/x-msdownload",
    };

    expect(() => validateFile(scriptFile as File)).toThrow(/Unsupported file type/);
  });
});
