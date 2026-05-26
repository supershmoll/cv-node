import { Injectable, Logger } from "@nestjs/common";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiKey = process.env.OPENAI_API_KEY ?? "";
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  private readonly baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async completeJson<T>(messages: ChatMessage[]): Promise<T | null> {
    const raw = await this.complete(messages, { json: true });
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn("Failed to parse LLM JSON response", error);
      return null;
    }
  }

  async completeText(messages: ChatMessage[]): Promise<string | null> {
    return this.complete(messages, { json: false });
  }

  private async complete(
    messages: ChatMessage[],
    options: { json: boolean }
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.2,
          messages,
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        error?: { message?: string };
      };

      if (!response.ok) {
        this.logger.error(
          `OpenAI request failed: ${payload.error?.message ?? response.statusText}`
        );
        return null;
      }

      return payload.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (error) {
      this.logger.error("OpenAI request error", error);
      return null;
    }
  }
}
