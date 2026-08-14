export type ImportedSurveyAnswer = {
  rank: number;
  word: string;
  points: number;
  aliases: string[];
};

export type ImportedSurveyQuestion = {
  prompt: string;
  answers: ImportedSurveyAnswer[];
};

type PendingAnswer = ImportedSurveyAnswer & {
  sourceOrder: number;
};

const LEGACY_ANSWER_PATTERN = /^#?\s*(\d+)\s*(?:[-.)]\s*)?(.+?)\s*(?:[-:]\s*)?(?:x\s*\(?\s*(\d+)\s*\)?|\(?\s*(\d+)\s*\)?\s*x)\s*$/i;
const SIMPLE_ANSWER_PATTERN = /^#?\s*(\d+)\s*(?:[.)-]\s*)?(.+?)\s*(?:-|:|\u2013|\u2014|\()\s*(\d+)\)?\s*$/;

function cleanAnswerWord(value: string) {
  return value.trim().replace(/\s*[-:]\s*$/, "").trim();
}

function parseAnswerLine(line: string, fallbackRank: number): ImportedSurveyAnswer | null {
  const pipeParts = line.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    const hasRank = /^\d+$/.test(pipeParts[0]);
    const wordIndex = hasRank ? 1 : 0;
    const pointsIndex = wordIndex + 1;
    const points = Number(pipeParts[pointsIndex]);
    if (pipeParts[wordIndex] && Number.isFinite(points) && points > 0) {
      return {
        rank: hasRank ? Number(pipeParts[0]) : fallbackRank,
        word: cleanAnswerWord(pipeParts[wordIndex]),
        points,
        aliases: pipeParts.slice(pointsIndex + 1).join(",").split(",").map((alias) => alias.trim()).filter(Boolean),
      };
    }
  }

  const legacy = line.match(LEGACY_ANSWER_PATTERN);
  if (legacy) return { rank: Number(legacy[1]), word: cleanAnswerWord(legacy[2]), points: Number(legacy[3] || legacy[4]), aliases: [] };
  const simple = line.match(SIMPLE_ANSWER_PATTERN);
  if (simple) return { rank: Number(simple[1]), word: cleanAnswerWord(simple[2]), points: Number(simple[3]), aliases: [] };
  return null;
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

    const parsed = parseAnswerLine(line, answers.length + 1);
    if (parsed) {
      const { word, points } = parsed;
      if (prompt.trim() && word && Number.isFinite(points) && points > 0) {
        answers.push({ ...parsed, sourceOrder });
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
