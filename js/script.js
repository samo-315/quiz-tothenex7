/**
 * 人物名当てクイズ
 * questions.json を読み込み、1問ずつ出題→正誤判定→最後にリザルト表示する。
 */

const state = {
  quizzes: [], // quizzes.json の内容（選択肢一覧）
  allQuestions: [], // 選択したクイズの問題データ（50音順などファイル記載順のまま）
  questions: [], // 出題用（毎回シャッフルしたコピー）
  index: 0,
  score: 0,
  answered: false, // 現在の問題にすでに回答/スキップ済みかどうか
  log: [], // { question, userAnswer, isCorrect, skipped }
};

const el = {
  screens: {
    start: document.getElementById("screen-start"),
    quiz: document.getElementById("screen-quiz"),
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
  scoreCount: document.getElementById("scoreCount"),
  scoreTotal: document.getElementById("scoreTotal"),
  scoreComment: document.getElementById("scoreComment"),
  reviewList: document.getElementById("reviewList"),
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
  el.btnRetry.addEventListener("click", resetQuiz);
}

function renderQuizList() {
  el.quizList.innerHTML = "";
  state.quizzes.forEach((quiz) => {
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

  buildProgressTrack();
  state.questions = shuffleArray(state.allQuestions); // 出題順は毎回ランダム化
  state.index = 0;
  state.score = 0;
  state.log = [];
  showScreen("quiz");
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.index];

  state.answered = false;

  el.qCounter.textContent = `Q${state.index + 1} / ${state.questions.length}`;
  el.qScoreLive.textContent = `SCORE ${state.score}`;
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
  const isCorrect = judge(userAnswer, q.answers);

  if (isCorrect) state.score += 1;
  state.log.push({ question: q, userAnswer, isCorrect, skipped: false });

  el.btnSubmit.disabled = true;
  el.btnSkip.disabled = true;
  el.answerInput.disabled = true;

  el.answerForm.hidden = true;
  el.feedback.hidden = false;
  el.feedbackResult.textContent = isCorrect ? "正解！" : "不正解";
  el.feedbackResult.className =
    "feedback-result " + (isCorrect ? "is-correct" : "is-wrong");
  el.feedbackAnswer.innerHTML = `正解は <strong>${formatAnswer(q)}</strong> でした`;

  el.qScoreLive.textContent = `SCORE ${state.score}`;
  updateBulbs();

  el.btnNext.textContent =
    state.index === state.questions.length - 1 ? "結果を見る" : "次の問題へ";
}

function handleSkip() {
  if (state.answered) return; // 二重操作防止
  state.answered = true;

  const q = state.questions[state.index];
  state.log.push({ question: q, userAnswer: null, isCorrect: false, skipped: true });

  el.btnSubmit.disabled = true;
  el.btnSkip.disabled = true;
  el.answerInput.disabled = true;

  el.answerForm.hidden = true;
  el.feedback.hidden = false;
  el.feedbackResult.textContent = "スキップしました";
  el.feedbackResult.className = "feedback-result is-skip";
  el.feedbackAnswer.innerHTML = `正解は <strong>${formatAnswer(q)}</strong> でした`;

  updateBulbs();

  el.btnNext.textContent =
    state.index === state.questions.length - 1 ? "結果を見る" : "次の問題へ";
}

/**
 * 正解表示用のフォーマット: 「漢字（ひらがな）」
 * answers[0]=漢字, answers[1]=ひらがな という運用に対応
 */
function formatAnswer(question) {
  const kanji = question.answers[0];
  const kana = question.answers[1];
  return kana ? `${escapeHtml(kanji)}（${escapeHtml(kana)}）` : escapeHtml(kanji);
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
  return acceptableAnswers.some((ans) => normalize(ans) === normalizedUser);
}

function showResult() {
  showScreen("result");
  el.scoreTotal.textContent = state.questions.length;
  animateScoreCount(state.score);

  const rate = state.score / state.questions.length;
  el.scoreComment.textContent =
    rate === 1
      ? "全問正解！お見事です。"
      : rate >= 0.7
      ? "ナイスな正答率です！"
      : rate >= 0.4
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
      <span class="review-correct">${escapeHtml(entry.question.answers[0])}</span>
      <span class="mark">${mark}</span>
    `;
    el.reviewList.appendChild(li);
  });
}

function animateScoreCount(target) {
  let current = 0;
  const step = () => {
    current += 1;
    el.scoreCount.textContent = current;
    if (current < target) requestAnimationFrame(() => setTimeout(step, 80));
  };
  if (target === 0) {
    el.scoreCount.textContent = "0";
  } else {
    step();
  }
}

function resetQuiz() {
  showScreen("start");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
