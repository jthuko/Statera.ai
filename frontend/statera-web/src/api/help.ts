import api from "./axios";

export interface HelpSection {
  heading?: string | null;
  body: string;
}

export interface HelpArticleDto {
  id: string;
  category: string;
  title: string;
  sortOrder: number;
  tags: string[];
  sections: HelpSection[];
}

export async function listHelpArticles(): Promise<HelpArticleDto[]> {
  const { data } = await api.get<HelpArticleDto[]>("/help/articles");
  return data;
}
