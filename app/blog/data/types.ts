export type Category =
  | "Marketing para Clínicas"
  | "WhatsApp para Clínicas"
  | "Google Avaliações"
  | "Gestão de Clínicas"
  | "Inteligência Artificial";

export type ContentBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "highlight"; text: string; author?: string; role?: string }
  | { type: "tip"; label: string; text: string }
  | { type: "stat"; value: string; label: string }
  | { type: "cta" };

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: Category;
  author: string;
  authorRole: string;
  publishedAt: string;
  readingTime: number;
  coverEmoji: string;
  excerpt: string;
  keywords: string[];
  content: ContentBlock[];
}
