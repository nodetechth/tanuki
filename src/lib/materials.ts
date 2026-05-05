import type { Material } from "@/lib/types";

export const materials: Material[] = [
  {
    id: "daily-coffee",
    level: "beginner",
    levelLabel: "WPM100",
    wpmRange: "WPM100",
    wpmDescription: "ゆっくり明瞭、ネイティブの丁寧な発話",
    category: "生活",
    title: "Morning Coffee",
    scriptText:
      "I usually grab a coffee before work, then I check my messages and plan the day.",
    audioUrl: null,
    duration: 35,
    accent: "US",
    focus: ["usually の弱形", "grab a のリンキング", "plan the day の語尾"],
  },
  {
    id: "weekend-plans",
    level: "beginner",
    levelLabel: "WPM110-120",
    wpmRange: "110〜120",
    wpmDescription: "ゆっくりな日常会話",
    category: "生活",
    title: "Weekend Plans",
    scriptText:
      "This weekend, I am going to visit a small bookstore and have lunch with my friend.",
    audioUrl: null,
    duration: 42,
    accent: "US",
    focus: ["going to の弱形", "visit a の連結", "with my friend のリズム"],
  },
  {
    id: "team-lunch",
    level: "intermediate",
    levelLabel: "WPM130-140",
    wpmRange: "130〜140",
    wpmDescription: "普通の会話速度",
    category: "ビジネス",
    title: "Team Lunch",
    scriptText:
      "We decided to have lunch together so everyone could share ideas in a relaxed way.",
    audioUrl: null,
    duration: 46,
    accent: "US",
    focus: ["decided to の連結", "everyone could の弱形", "relaxed way の語尾"],
  },
  {
    id: "quarterly-update",
    level: "intermediate",
    levelLabel: "WPM150-160",
    wpmRange: "150〜160",
    wpmDescription: "自然なスピード",
    category: "ビジネス",
    title: "Quarterly Update",
    scriptText:
      "Our team improved the onboarding flow, but we still need to reduce support tickets next quarter.",
    audioUrl: null,
    duration: 48,
    accent: "US",
    focus: ["improved the の連結", "support tickets の子音", "quarter の母音"],
  },
  {
    id: "global-markets",
    level: "advanced",
    levelLabel: "WPM170-180",
    wpmRange: "170〜180",
    wpmDescription: "ニュース・プレゼン速度",
    category: "ニュース",
    title: "Global Markets",
    scriptText:
      "Analysts expect global markets to remain cautious as central banks signal a slower path toward rate cuts.",
    audioUrl: null,
    duration: 58,
    accent: "US",
    focus: ["analysts の子音連続", "central banks の脱落", "toward rate cuts のリズム"],
  },
  {
    id: "startup-pitch",
    level: "advanced",
    levelLabel: "WPM190-200",
    wpmRange: "190〜200",
    wpmDescription: "ネイティブの速い会話",
    category: "テクノロジー",
    title: "Startup Pitch",
    scriptText:
      "The founder explained how their product helps remote teams review customer feedback and prioritize urgent fixes.",
    audioUrl: null,
    duration: 60,
    accent: "US",
    focus: ["founder explained の連結", "customer feedback の強弱", "prioritize urgent の子音"],
  },
];

export function getMaterial(materialId: string) {
  return materials.find((material) => material.id === materialId) ?? null;
}
