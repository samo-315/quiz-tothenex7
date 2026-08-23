/**
 * 人物名当てクイズ
 * questions.json を読み込み、1問ずつ出題→正誤判定→最後にリザルト表示する。
 */

const state = {
  quizzes: [], // quizzes.json の内容（選択肢一覧）
  allQuestions: [], // 選択したクイズの問題データ（50音順などファイル記載順のまま）
  questions: [], // 出題用（毎回シャッフルしたコピー）
  currentQuiz: null, // 今挑戦中のクイズ（quizzes.jsonの1件分。titleをシェア文言に使う）
  totalPoints: 0, // 満点（シェア文言に使う）
  index: 0,
  score: 0,
  points: 0, // 獲得点数の合計
  answered: false, // 現在の問題にすでに回答/スキップ済みかどうか
  log: [], // { question, userAnswer, isCorrect, skipped }
};

const el = {
  screens: {
    start: document.getElementById("screen-start"),
    quiz: document.getElementById("screen-quiz"),
    quizBatch: document.getElementById("screen-quiz-batch"),
    result: document.getElementById("screen-result"),
  },
  progressTrack: document.getElementById("progressTrack"),
  quizList: document.getElementById("quizList"),
  qCounter: document.getElementById("qCounter"),
  qScoreLive: document.getElementById("qScoreLive"),
  qImage: document.getElementById("qImage"),
  answerForm: document.getElementById("answerForm"),
  answerInput: document.getElementById("answerInput"),
  btnSubmit: document.getElementById("btnSubmit"),
  btnSkip: document.getElementById("btnSkip"),
  feedback: document.getElementById("feedback"),
  feedbackResult: document.getElementById("feedbackResult"),
  feedbackAnswer: document.getElementById("feedbackAnswer"),
  btnNext: document.getElementById("btnNext"),
  batchQuizTitle: document.getElementById("batchQuizTitle"),
  batchForm: document.getElementById("batchForm"),
  batchQuestionList: document.getElementById("batchQuestionList"),
  scoreCount: document.getElementById("scoreCount"),
  scoreTotal: document.getElementById("scoreTotal"),
  pointsCount: document.getElementById("pointsCount"),
  pointsTotal: document.getElementById("pointsTotal"),
  scoreComment: document.getElementById("scoreComment"),
  reviewList: document.getElementById("reviewList"),
  btnShare: document.getElementById("btnShare"),
  btnRetry: document.getElementById("btnRetry"),
};

init();

async function init() {
  try {
    const res = await fetch("quizzes.json");
    if (!res.ok) throw new Error("quizzes.json の読み込みに失敗しました");
    state.quizzes = await res.json();
  } catch (err) {
    console.error(err);
    alert(
      "クイズ一覧を読み込めませんでした。\n" +
        "ローカルで開いている場合は簡易サーバー経由（例: python3 -m http.server）で開くか、GitHub Pages で確認してください。"
    );
    return;
  }

  renderQuizList();
  el.answerForm.addEventListener("submit", handleSubmit);
  el.btnSkip.addEventListener("click", handleSkip);
  el.btnNext.addEventListener("click", nextQuestion);
  el.btnShare.addEventListener("click", handleShare);
  el.btnRetry.addEventListener("click", resetQuiz);
  el.batchForm.addEventListener("submit", handleBatchSubmit);
}

function renderQuizList() {
  el.quizList.innerHTML = "";
  state.quizzes
    .filter((quiz) => !quiz.hidden) // hidden: true のクイズは選択画面に出さない
    .forEach((quiz) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-card";
    button.innerHTML = `
      <p class="quiz-card-title">${escapeHtml(quiz.title)}</p>
      <p class="quiz-card-desc">${escapeHtml(quiz.description || "")}</p>
      <p class="quiz-card-meta">START →</p>
    `;
    button.addEventListener("click", () => startQuiz(quiz));
    li.appendChild(button);
    el.quizList.appendChild(li);
  });
}

function showScreen(name) {
  Object.values(el.screens).forEach((s) => s.classList.remove("active"));
  el.screens[name].classList.add("active");
}

function buildProgressTrack() {
  el.progressTrack.innerHTML = "";
  state.allQuestions.forEach(() => {
    const bulb = document.createElement("div");
    bulb.className = "bulb";
    el.progressTrack.appendChild(bulb);
  });
}

/**
 * Fisher–Yates シャッフル（元の配列は変更せず新しい配列を返す）
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 画像を先読みしてブラウザキャッシュに乗せておく（表示時のラグを減らす）
 */
function preloadImage(src) {
  if (!src) return;
  const img = new Image();
  img.src = src;
}

async function startQuiz(quiz) {
  try {
    const res = await fetch(quiz.questionsFile);
    if (!res.ok) throw new Error(`${quiz.questionsFile} の読み込みに失敗しました`);
    state.allQuestions = await res.json();
  } catch (err) {
    console.error(err);
    alert("問題データを読み込めませんでした。ファイルの配置やパスを確認してください。");
    return;
  }

  state.currentQuiz = quiz; // シェア文言・タイトル表示用に保持
  state.questions = shuffleArray(state.allQuestions); // 出題順は毎回ランダム化
  state.index = 0;
  state.score = 0;
  state.points = 0;
  state.log = [];

  if (quiz.type === "batch") {
    startBatchQuiz();
  } else {
    startSequentialQuiz();
  }
}

/**
 * 1問ずつ画面遷移するタイプの出題（人物名当てクイズなど）
 */
function startSequentialQuiz() {
  buildProgressTrack();

  // 出題順が決まった時点で全画像の先読みを開始（表示時のラグを減らす）
  state.questions.forEach((q) => preloadImage(q.image));

  showScreen("quiz");
  renderQuestion();
}

/**
 * 全問1画面に並べて、まとめて送信するタイプの出題（文章問題クイズなど）
 */
function startBatchQuiz() {
  el.batchQuizTitle.textContent = state.currentQuiz?.title ?? "";
  renderBatchQuestions();
  showScreen("quizBatch");
}

function renderBatchQuestions() {
  el.batchQuestionList.innerHTML = "";
  state.questions.forEach((q, i) => {
    const li = document.createElement("li");
    li.className = "batch-question";
    li.innerHTML = `
      <span class="batch-question-number">Q${i + 1}</span>
      <p class="batch-question-text">${escapeHtml(q.question)}</p>
      <textarea class="batch-answer-input" data-index="${i}" rows="2" placeholder="回答を入力"></textarea>
    `;
    el.batchQuestionList.appendChild(li);
  });
}

function handleBatchSubmit(e) {
  e.preventDefault();

  const inputs = el.batchQuestionList.querySelectorAll(".batch-answer-input");
  state.log = [];
  state.score = 0;
  state.points = 0;

  inputs.forEach((input) => {
    const i = Number(input.dataset.index);
    const q = state.questions[i];
    const userAnswer = input.value.trim();

    if (!userAnswer) {
      // 未入力はスキップ扱い
      state.log.push({ question: q, userAnswer: null, isCorrect: false, skipped: true, earnedPoints: 0 });
      return;
    }

    const matchedIndex = judge(userAnswer, q.answers);
    const isCorrect = matchedIndex !== -1;
    const earnedPoints = getEarnedPoints(q, matchedIndex);

    if (isCorrect) state.score += 1;
    state.points += earnedPoints;
    state.log.push({ question: q, userAnswer: input.value, isCorrect, skipped: false, earnedPoints });
  });

  showResult();
}

function renderQuestion() {
  const q = state.questions[state.index];

  state.answered = false;

  el.qCounter.textContent = `Q${state.index + 1} / ${state.questions.length}`;
  el.qScoreLive.textContent = `SCORE ${state.points}pt / ${state.score}○`;
  el.qImage.src = q.image;
  el.qImage.alt = "誰でしょう？";

  el.answerInput.value = "";
  el.answerInput.disabled = false;
  el.btnSubmit.disabled = false;
  el.btnSkip.disabled = false;

  el.answerForm.hidden = false;
  el.feedback.hidden = true;
  el.feedbackResult.textContent = "";
  el.feedbackAnswer.innerHTML = "";

  updateBulbs();

  // 少し遅れてフォーカス（モバイルでキーボードが即座に開くのを避ける）
  setTimeout(() => el.answerInput.focus(), 50);
}

function updateBulbs() {
  const bulbs = el.progressTrack.querySelectorAll(".bulb");
  bulbs.forEach((bulb, i) => {
    bulb.classList.remove("current", "correct", "wrong", "skip");
    if (i < state.log.length) {
      const entry = state.log[i];
      if (entry.skipped) {
        bulb.classList.add("skip");
      } else {
        bulb.classList.add(entry.isCorrect ? "correct" : "wrong");
      }
    } else if (i === state.index) {
      bulb.classList.add("current");
    }
  });
}

function handleSubmit(e) {
  e.preventDefault();
  if (state.answered) return; // 二重回答防止
  state.answered = true;

  const q = state.questions[state.index];
  const userAnswer = el.answerInput.value;
  const matchedIndex = judge(userAnswer, q.answers); // -1, 0(漢字), 1(ひらがな)
  const isCorrect = matchedIndex !== -1;
  const earnedPoints = getEarnedPoints(q, matchedIndex);

  if (isCorrect) state.score += 1;
  state.points += earnedPoints;
  state.log.push({ question: q, userAnswer, isCorrect, skipped: false, earnedPoints });

  el.btnSubmit.disabled = true;
  el.btnSkip.disabled = true;
  el.answerInput.disabled = true;

  el.answerForm.hidden = true;
  el.feedback.hidden = false;
  el.feedbackResult.textContent = isCorrect ? "正解！" : "不正解";
  el.feedbackResult.className =
    "feedback-result " + (isCorrect ? "is-correct" : "is-wrong");
  el.feedbackAnswer.innerHTML = `正解は <strong>${formatAnswer(q)}</strong> でした`;

  el.qScoreLive.textContent = `SCORE ${state.points}pt / ${state.score}○`;
  updateBulbs();

  el.btnNext.textContent =
    state.index === state.questions.length - 1 ? "結果を見る" : "次の問題へ";
}

function handleSkip() {
  if (state.answered) return; // 二重操作防止
  state.answered = true;

  const q = state.questions[state.index];
  state.log.push({ question: q, userAnswer: null, isCorrect: false, skipped: true, earnedPoints: 0 });

  el.btnSubmit.disabled = true;
  el.btnSkip.disabled = true;
  el.answerInput.disabled = true;

  el.answerForm.hidden = true;
  el.feedback.hidden = false;
  el.feedbackResult.textContent = "スキップしました";
  el.feedbackResult.className = "feedback-result is-skip";
  el.feedbackAnswer.innerHTML = `正解は <strong>${formatAnswer(q)}</strong> でした`;
  el.qScoreLive.textContent = `SCORE ${state.points}pt / ${state.score}○`;

  updateBulbs();

  el.btnNext.textContent =
    state.index === state.questions.length - 1 ? "結果を見る" : "次の問題へ";
}

/**
 * 正解表示用のフォーマット
 * - question.displayAnswer がある場合（文章問題クイズなど）: それをそのまま表示
 * - ない場合（人物名当てクイズなど）: 「漢字（ひらがな）」形式
 *   answers[0]=漢字, answers[1]=ひらがな という運用に対応
 */
function formatAnswer(question, { newlineBetween = false } = {}) {
  if (question.displayAnswer) return escapeHtml(question.displayAnswer);

  const kanji = escapeHtml(question.answers[0]);
  const kana = question.answers[1] ? escapeHtml(question.answers[1]) : "";
  if (!kana) return kanji;
  return newlineBetween ? `${kanji}<br>（${kana}）` : `${kanji}（${kana}）`;
}

function nextQuestion() {
  state.index += 1;
  if (state.index >= state.questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

/**
 * 正誤判定
 * - 前後の空白を除去
 * - 全角/半角の英数字を統一
 * - 大文字/小文字を統一
 * - answers 配列内のいずれかと一致すれば正解
 *   （表記ゆれは questions.json 側に別解として追加する運用）
 */
function judge(userAnswer, acceptableAnswers) {
  const normalize = (str) =>
    str
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
      );

  const normalizedUser = normalize(userAnswer);
  // 一致した箇所の添字を返す（0=漢字, 1=ひらがな, -1=不一致）
  return acceptableAnswers.findIndex((ans) => normalize(ans) === normalizedUser);
}

/**
 * 一致した箇所に応じた獲得点数を返す
 * - question.points が数値の場合（文章問題クイズなど）: 正解なら points をそのまま加算
 * - question.points が {kanji, hiragana} の場合（人物名当てクイズなど）: 一致した表記に応じて加算
 */
function getEarnedPoints(question, matchedIndex) {
  if (matchedIndex === -1) return 0;
  if (typeof question.points === "number") return question.points;
  if (matchedIndex === 0) return question.points?.kanji ?? 1;
  if (matchedIndex === 1) return question.points?.hiragana ?? 1;
  return 1;
}

function showResult() {
  showScreen("result");

  const totalPoints = state.questions.reduce(
    (sum, q) => sum + (typeof q.points === "number" ? q.points : q.points?.kanji ?? 1),
    0
  );
  state.totalPoints = totalPoints; // シェア文言用に保持
  el.pointsTotal.textContent = totalPoints;
  el.scoreTotal.textContent = state.questions.length;
  animateCount(el.pointsCount, state.points);
  animateCount(el.scoreCount, state.score);

  const rate = state.score / state.questions.length;
  el.scoreComment.textContent =
    rate === 1
      ? "パーフェクト！スーパーウルトラミラクルナイスゥ！！"
      : rate >= 0.7
      ? "ナイスな正答率です！"
      : rate >= 0.5
      ? "まずまずの結果です。"
      : "次はもっと解けるはず！復習してみましょう。";

  el.reviewList.innerHTML = "";
  state.log.forEach((entry, i) => {
    const li = document.createElement("li");
    li.className =
      "review-item" + (entry.skipped ? " skip" : entry.isCorrect ? "" : " wrong");
    const yourAnswerText = entry.skipped
      ? "(スキップ)"
      : entry.userAnswer || "(未回答)";
    const mark = entry.skipped ? "⏭️" : entry.isCorrect ? "✅" : "❌";
    li.innerHTML = `
      <span class="review-q">Q${i + 1}</span>
      <span class="review-your">${escapeHtml(yourAnswerText)}</span>
      <span class="review-correct">${formatAnswer(entry.question, { newlineBetween: true })}</span>
      <span class="mark">${mark}<span class="review-points">${entry.earnedPoints}pt</span></span>
    `;
    el.reviewList.appendChild(li);
  });
}

function animateCount(targetEl, target) {
  let current = 0;
  const step = () => {
    current += 1;
    targetEl.textContent = current;
    if (current < target) requestAnimationFrame(() => setTimeout(step, 80));
  };
  if (target === 0) {
    targetEl.textContent = "0";
  } else {
    step();
  }
}

function resetQuiz() {
  showScreen("start");
}

/**
 * シェア用の投稿文を組み立てる
 * 例: 「人物名当てクイズ」で 45pt / 54pt（20問/27問）でした！
 *     https://example.com/quiz-site/
 */
function buildShareText() {
  const quizTitle = state.currentQuiz?.title ?? "クイズ";
  return `「${quizTitle}」で ${state.points}pt / ${state.totalPoints}pt（${state.score}問/${state.questions.length}問）でした！\n${location.href}`;
}

/**
 * 結果をシェアする
 * - Web Share API対応端末（主にスマホ）: 標準の共有メニューを開く
 * - 非対応環境（主にPCブラウザ）: クリップボードにコピーして案内する
 */
async function handleShare() {
  const shareText = buildShareText();

  if (navigator.share) {
    try {
      await navigator.share({ text: shareText });
    } catch (err) {
      // ユーザーが共有メニューをキャンセルした場合などはここに来るが、何もしなくてよい
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(shareText);
    alert("結果をコピーしました。SNSアプリなどに貼り付けて投稿してください。");
  } catch (err) {
    console.error(err);
    alert("コピーに失敗しました。お手数ですが結果を手動でコピーしてください。");
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

