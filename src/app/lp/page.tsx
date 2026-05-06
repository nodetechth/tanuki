import type { Metadata } from "next";
import Image from "next/image";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "tanuki | 聴いて、話して、覚える。",
  description:
    "リスニング、シャドーイング、単語検索、AI発音添削をひとつにまとめた英語学習アプリです。",
};

const featureCards = [
  { title: "初回添削", text: "1回無料", image: "/lp/2.png" },
  { title: "単語検索", text: "使い放題", image: "/lp/3.png" },
  { title: "リスニング", text: "し放題", image: "/lp/4.png" },
  { title: "カード登録", text: "不要", image: "/lp/5.png" },
];

const storyCards = [
  {
    title: "tanukiは\n聴く・話す・覚えるが\n全部ひとつに。",
    text: "アプリを切り替える手間も、続かない高い教材もなくなります。",
  },
  {
    title: "tanukiは\n月額980円。",
    text: "録音のAI tutorが、細かな発音も添削します。価格を理由に諦めなくていい。",
  },
  {
    title: "リスニングで耳を鍛え、単語で語彙を増やすことで会話力は自然と底上げされます。",
    text: "聴く、話す、覚えるをひとつの流れで続けられます。",
  },
  {
    title: "例文や教材は全てアプリ内の全ての音声が、ネイティブに近い自然な音声で再生できます。",
    text: "英語を聞いて練習しながら、正しい発音を身につけられます。",
  },
  {
    title: "あなたのレベルと用途に合わせた例文を表示。",
    text: "たとえば「TOEICのため」「旅行で使いたい」など、目的別に使える例文で覚えられます。",
  },
  {
    title: "苦手な単語を溜め込むだけでなく、その単語を使った学習教材を自動で作成。",
    text: "覚えたい単語を自然に使って練習できます。",
  },
];

const steps = [
  {
    number: "1",
    title: "記事を選んで聴く",
    text: "レベルとジャンルで好きな英文を選んで英語に触れる。知らない単語はタップして調べられます。",
  },
  {
    number: "2",
    title: "そのままシャドーイング",
    text: "読んで内容を理解した記事でそのまま録音。内容がわかっているから、音をマネしやすいです。",
  },
  {
    number: "3",
    title: "AIが数秒で添削",
    text: "録音して送るだけ。発音・流暢さ・完成度をAIが分析し具体的な改善コメントがすぐ届きます。",
  },
];

const comparisonRows = [
  ["月額料金", "¥980", "¥14,000〜¥21,000", "無料〜¥3,000"],
  ["フィードバック頻度", "数秒", "翌日", "数秒"],
  ["フィードバック内容", "具体的な改善コメント", "具体的な改善コメント", "スコアのみ"],
  ["リスニング教材", "○", "×", "△"],
  ["単語検索・復習", "○", "×", "×"],
  ["記事・シャドーイング連動", "○", "×", "×"],
  ["苦手単語から学習教材を自動作成", "○", "×", "×"],
  ["アプリ1本で完結", "○", "×", "×"],
];

const pricingCards = [
  {
    title: "無料体験",
    text: "初回添削1回無料",
    sub: "カード登録不要",
    tone: "green",
  },
  {
    title: "3日間無料トライアル",
    text: "全機能が使い放題",
    sub: "自動更新の前日にお知らせ",
    tone: "blue",
  },
  {
    title: "月額 ¥980",
    text: "いつでも解約可能",
    sub: "",
    tone: "orange",
  },
];

function CtaButton() {
  return (
    <a className={styles.ctaButton} href="#pricing">
      <span className={styles.ctaIcon}>↓</span>
      まずはダウンロードで無料体験
    </a>
  );
}

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.brand}>
          <Image src="/lp/logo.png" alt="" width={375} height={375} />
          <span>Tanuki</span>
        </div>

        <div className={styles.heroCopy}>
          <h1>
            聴いて、
            <br />
            話して、
            <br />
            覚える。
          </h1>
          <p className={styles.heroLead}>
            全部<span>Tanuki</span>で。
          </p>
          <p className={styles.heroText}>
            AIが数秒で発音を添削。リスニングから単語まで、英語学習に必要なことがひとつのアプリで完結します。
          </p>
        </div>

        <div className={styles.heroAction}>
          <CtaButton />
          <p className={styles.ctaNote}>※現在はWebアプリで提供中　DL不要ですぐに利用可能</p>
        </div>
      </section>

      <section className={styles.features} aria-label="主な機能">
        {featureCards.map((feature) => (
          <article className={styles.featureCard} key={feature.title}>
            <Image src={feature.image} alt="" width={2000} height={2000} />
            <strong>{feature.title}</strong>
            <span>{feature.text}</span>
          </article>
        ))}
      </section>

      <section className={styles.storyGrid} aria-label="tanukiで解決できること">
        {storyCards.map((card, index) => (
          <article className={styles.storyCard} key={`${card.title}-${index}`}>
            <span className={styles.storyNumber}>{index + 1}</span>
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </article>
        ))}
      </section>

      <section className={styles.stepsSection}>
        <p className={styles.sectionKicker}>+ 3ステップで始められる +</p>
        <div className={styles.steps}>
          {steps.map((step) => (
            <article className={styles.stepCard} key={step.number}>
              <span className={styles.stepNumber}>STEP {step.number}</span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.comparisonSection}>
        <p className={styles.sectionKicker}>他サービスとの比較</p>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>項目</th>
                <th>tanuki</th>
                <th>高額添削サービス</th>
                <th>一般AIアプリ</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={`${row[0]}-${cell}-${index}`}
                      className={index === 1 ? styles.tanukiCell : undefined}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <p className={styles.sectionKicker}>料金</p>
        <div className={styles.pricingGrid}>
          {pricingCards.map((card) => (
            <article className={`${styles.priceCard} ${styles[card.tone]}`} key={card.title}>
              <strong>{card.title}</strong>
              <span>{card.text}</span>
              {card.sub ? <p>{card.sub}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <p>今日の発音、今日直そう。</p>
        <CtaButton />
        <span>※現在はWebアプリで提供中。DL不要ですぐに利用可能</span>
      </section>
    </main>
  );
}
