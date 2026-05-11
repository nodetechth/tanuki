export type TabId = "home" | "shadowing" | "listening" | "search";

export type Article = {
  id: string;
  contentType: "shadowing" | "listening";
  title: string;
  description: string;
  category: string;
  level: string;
  duration: string;
  date: string;
  isFavorite?: boolean;
  isCompleted?: boolean;
  wpm?: number;
};

export type WordFolder = {
  id: string;
  name: string;
  count: number;
};
