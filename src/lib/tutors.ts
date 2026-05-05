export type TutorId = "a_san" | "b_san";

export type TutorAvatarType = "gentle" | "strict";

export type TutorProfile = {
  id: TutorId;
  displayName: string;
  roleLabel: string;
  shortDescription: string;
  avatarType: TutorAvatarType;
  promptProfile: {
    systemAddendum: string;
    coachingPolicy: {
      goodPoints: string;
      developmentPoints: string;
      aiComment: string;
    };
    constraints: string[];
  };
};

const currentCoachingPolicy = {
  goodPoints:
    "毎回2件だけ選ぶ。低スコアの場合は、発音を褒めすぎず、確認できた取り組みや部分的に読めた事実を書く。高スコアの場合は、実際に良かった音・リズム・つながりを具体的に書く。",
  developmentPoints:
    "毎回2件だけ選ぶ。problemWordsから優先度の高い語句を選び、何をどう直すかを日本語で具体的に書く。単語名を必ず含める。",
  aiComment:
    "120〜180字程度。次回の録音で実行できる練習手順を含める。毎回同じ言い回しを避ける。",
};

const currentConstraints = [
  "文体はフレンドリーなコーチ風。「〜してください」より「〜してみよう」「〜のイメージで」のように自然に。",
  "goodPointsは必ず2件。1件ごとに1つの良かった点だけを書く。低スコアの場合は無理に発音を褒めず、確認できた事実を書く。",
  "developmentPointsは必ず2件。1件ごとに1つの気になった点だけを書く。必ず具体的な単語名と口/舌/息のイメージを含める。",
  "problemWordsは最大4件。教材文に実際に含まれる単語だけを入れる。",
  "nextFocusは1件だけ。次回意識することを1つに絞り、短く書く。",
  "aiCommentは自然な日本語で、学習者が次に録音するときの行動が分かる内容にする。",
  "Azureやスコア処理など内部技術名は出さない。",
];

export const tutorProfiles: TutorProfile[] = [
  {
    id: "a_san",
    displayName: "Aさん",
    roleLabel: "やさしめチューター",
    shortDescription: "安心して続けやすい言葉で、次の一歩を整理します。",
    avatarType: "gentle",
    promptProfile: {
      systemAddendum: "",
      coachingPolicy: currentCoachingPolicy,
      constraints: currentConstraints,
    },
  },
  {
    id: "b_san",
    displayName: "Bさん",
    roleLabel: "しっかりチューター",
    shortDescription: "改善点をはっきり確認し、練習ポイントを絞ります。",
    avatarType: "strict",
    promptProfile: {
      systemAddendum: "",
      coachingPolicy: currentCoachingPolicy,
      constraints: currentConstraints,
    },
  },
];

export function getTutorProfile(id: string | null | undefined): TutorProfile {
  return tutorProfiles.find((tutor) => tutor.id === id) ?? tutorProfiles[0];
}
