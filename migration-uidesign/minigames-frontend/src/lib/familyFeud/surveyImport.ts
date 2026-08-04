export type ImportedSurveyAnswer = {
  rank: number;
  word: string;
  points: number;
};

export type ImportedSurveyQuestion = {
  prompt: string;
  answers: ImportedSurveyAnswer[];
};

type PendingAnswer = ImportedSurveyAnswer & {
  sourceOrder: number;
};

const ANSWER_LINE_PATTERN = /^#?\s*(\d+)\s*(?:[-.)]\s*)?(.+?)\s*(?:[-:]\s*)?(?:x\s*\(?\s*(\d+)\s*\)?|\(?\s*(\d+)\s*\)?\s*x)\s*$/i;

function cleanAnswerWord(value: string) {
  return value.trim().replace(/\s*[-:]\s*$/, "").trim();
}

export function parseSurveyQuestionBlocks(source: string, maxAnswers: number) {
  const questions: ImportedSurveyQuestion[] = [];
  let prompt = "";
  let answers: PendingAnswer[] = [];
  let sourceOrder = 0;

  const commitQuestion = () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || answers.length === 0) {
      prompt = "";
      answers = [];
      return;
    }

    questions.push({
      prompt: cleanPrompt,
      answers: [...answers]
        .sort((left, right) => left.rank - right.rank || left.sourceOrder - right.sourceOrder)
        .slice(0, maxAnswers)
        .map(({ sourceOrder: _sourceOrder, ...answer }) => answer),
    });
    prompt = "";
    answers = [];
  };

  for (const sourceLine of source.replace(/\r/g, "").split("\n")) {
    const line = sourceLine.trim();
    if (!line) {
      commitQuestion();
      continue;
    }

    const match = line.match(ANSWER_LINE_PATTERN);
    if (match) {
      const word = cleanAnswerWord(match[2]);
      const points = Number(match[3] || match[4]);
      if (prompt.trim() && word && Number.isFinite(points) && points > 0) {
        answers.push({ rank: Number(match[1]), word, points, sourceOrder });
        sourceOrder += 1;
      }
      continue;
    }

    if (answers.length > 0) {
      commitQuestion();
    }
    prompt = prompt ? `${prompt} ${line}` : line;
  }

  commitQuestion();
  return questions;
}
