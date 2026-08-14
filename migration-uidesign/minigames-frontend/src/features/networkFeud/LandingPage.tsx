"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createFeudGame, importFeudQuestions, listFeudQuestions } from "@/lib/familyFeud/api";
import { parseSurveyQuestionBlocks } from "@/lib/familyFeud/surveyImport";
import { hasNetworkRole, useNetworkSession } from "@/lib/networkSession";
import styles from "./network-feud.module.css";

function normalizeCode(value: string) {
  const plain = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (plain.startsWith("NF") && plain.length > 2) return `NF-${plain.slice(2, 6)}`;
  return plain;
}

const QUESTION_EXAMPLE = `Name something people do before going to bed
1. Check their phone - 38
2. Brush their teeth - 27
3. Set an alarm - 18
4. Drink water - 10

Name something you might forget when leaving home
1. Keys - 42
2. Phone - 31
3. Wallet - 19
4. Headphones - 8`;

export function LandingPage() {
  const router = useRouter();
  const { user, token, isHydrated } = useNetworkSession();
  const canHost = Boolean(user && (user.role === "MANAGER" || user.role === "ADMIN" || hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN")));
  const [joinCode, setJoinCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Friday Game Night");
  const [teamAlphaName, setTeamAlphaName] = useState("Team 1");
  const [teamBetaName, setTeamBetaName] = useState("Team 2");
  const [roundCount, setRoundCount] = useState(4);
  const [answerSeconds, setAnswerSeconds] = useState(20);
  const [questionMode, setQuestionMode] = useState<"library" | "paste">("library");
  const [pack, setPack] = useState("Network Feud Starter");
  const [availablePacks, setAvailablePacks] = useState<Array<{ name: string; count: number }>>([]);
  const [questionText, setQuestionText] = useState("");
  const parsedQuestions = useMemo(() => parseSurveyQuestionBlocks(questionText, 10), [questionText]);

  useEffect(() => {
    if (!token || !canHost) return;
    listFeudQuestions(token).then((questions) => {
      const counts = new Map<string, number>();
      for (const question of questions.filter((item) => item.active)) counts.set(question.pack, (counts.get(question.pack) || 0) + 1);
      setAvailablePacks([...counts].map(([name, count]) => ({ name, count })));
    }).catch(() => undefined);
  }, [token, canHost]);

  const join = () => {
    const code = normalizeCode(joinCode);
    if (!code) return setError("Enter the game code shown by the host.");
    router.push(`/feud/lobby/${code}`);
  };

  const openSetup = () => {
    if (!user) return router.push("/login?next=/feud");
    if (!canHost) return setError("Only network managers and admins can create a match. You can still join with a code.");
    setError(null);
    setShowSetup(true);
  };

  const create = async () => {
    if (!token || !canHost) return openSetup();
    const cleanTitle = title.trim();
    const alpha = teamAlphaName.trim();
    const beta = teamBetaName.trim();
    if (!cleanTitle || !alpha || !beta) return setError("Add a match name and both team names.");
    if (alpha.toLowerCase() === beta.toLowerCase()) return setError("Use a different name for each team.");

    let selectedPack = pack;
    if (questionMode === "paste") {
      if (parsedQuestions.length < roundCount) return setError(`Paste at least ${roundCount} valid question blocks, one for each round.`);
      if (parsedQuestions.some((question) => question.answers.length < 2)) return setError("Every question needs at least two answers with points.");
      selectedPack = `${cleanTitle} - ${Date.now()}`;
    } else {
      const chosen = availablePacks.find((item) => item.name === pack);
      if (chosen && chosen.count < roundCount) return setError(`${pack} has ${chosen.count} questions. Reduce the rounds or choose another pack.`);
    }

    setCreating(true);
    setError(null);
    try {
      if (questionMode === "paste") {
        await importFeudQuestions(token, {
          pack: selectedPack,
          questions: parsedQuestions.map((question) => ({
            question: question.prompt,
            category: "GENERAL",
            pack: selectedPack,
            active: true,
            answers: question.answers.map((answer) => ({ answer: answer.word, points: answer.points, aliases: answer.aliases })),
          })),
        });
      }
      const game = await createFeudGame(token, {
        title: cleanTitle,
        teamAlphaName: alpha,
        teamBetaName: beta,
        config: { maxPlayersPerTeam: 5, answerSeconds, roundCount, fastMoneyTarget: 200, pack: selectedPack },
      });
      router.push(`/feud/manager/${game.game.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The match could not be created.");
    } finally {
      setCreating(false);
    }
  };

  return <div className={styles.shell}>
    <main className={`${styles.container} ${styles.landing}`}>
      <header className={styles.pageIntro}>
        <p className={styles.eyebrow}>Live team game</p>
        <h1 className={styles.landingTitle}>Network Feud</h1>
        <p className={styles.subhead}>Join a match with the code on screen, or set up a new game for your event.</p>
      </header>

      <div className={styles.entryGrid}>
        <section className={`${styles.card} ${styles.cardPad} ${styles.entryCard}`}>
          <span className={styles.stepNumber}>1</span>
          <div>
            <h2 className={styles.sectionTitle}>Join a game</h2>
            <p className={styles.sectionCopy}>Enter the code provided by the manager. You will choose a team in the lobby.</p>
          </div>
          <div className={styles.joinBox}>
            <input className={styles.input} value={joinCode} onChange={(event) => setJoinCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && join()} placeholder="NF-2048" aria-label="Game code" autoComplete="off" />
            <button className={styles.button} onClick={join}>Continue</button>
          </div>
        </section>

        <section className={`${styles.card} ${styles.cardPad} ${styles.entryCard}`}>
          <span className={styles.stepNumber}>2</span>
          <div>
            <h2 className={styles.sectionTitle}>Host a game</h2>
            <p className={styles.sectionCopy}>Name the teams, choose the number of rounds, and add your survey questions.</p>
          </div>
          <button className={`${styles.button} ${styles.buttonSecondary}`} disabled={!isHydrated} onClick={openSetup}>{user ? "Set up a match" : "Sign in to host"}</button>
        </section>
      </div>

      {showSetup ? <section className={`${styles.card} ${styles.setupPanel}`}>
        <div className={styles.setupHeading}>
          <div><p className={styles.eyebrow}>Match setup</p><h2>Everything players will see</h2></div>
          <button className={styles.textButton} type="button" onClick={() => setShowSetup(false)}>Close</button>
        </div>
        <div className={styles.setupGrid}>
          <div className={styles.stack}>
            <label className={styles.field}><span>Match name</span><input className={styles.input} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <div className={styles.grid2}>
              <label className={styles.field}><span>Team 1 name</span><input className={styles.input} value={teamAlphaName} onChange={(event) => setTeamAlphaName(event.target.value)} /></label>
              <label className={styles.field}><span>Team 2 name</span><input className={styles.input} value={teamBetaName} onChange={(event) => setTeamBetaName(event.target.value)} /></label>
            </div>
            <div className={styles.grid2}>
              <label className={styles.field}><span>Rounds</span><select className={styles.select} value={roundCount} onChange={(event) => setRoundCount(Number(event.target.value))}>{[2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
              <label className={styles.field}><span>Seconds per answer</span><select className={styles.select} value={answerSeconds} onChange={(event) => setAnswerSeconds(Number(event.target.value))}>{[15, 20, 30, 45].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label>
            </div>
          </div>

          <div className={styles.questionSetup}>
            <div className={styles.modeTabs} role="tablist" aria-label="Question source">
              <button className={questionMode === "library" ? styles.activeTab : ""} onClick={() => setQuestionMode("library")} type="button">Use saved questions</button>
              <button className={questionMode === "paste" ? styles.activeTab : ""} onClick={() => setQuestionMode("paste")} type="button">Paste new questions</button>
            </div>
            {questionMode === "library" ? <div className={styles.stack}>
              <label className={styles.field}><span>Question pack</span><select className={styles.select} value={pack} onChange={(event) => setPack(event.target.value)}>{availablePacks.length ? availablePacks.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>) : <option value="Network Feud Starter">Network Feud Starter</option>}</select></label>
              <p className={styles.helper}>Questions are selected automatically from this pack when each round starts.</p>
              <Link className={styles.inlineLink} href="/admin/feud/questions">Open the full question library</Link>
            </div> : <div className={styles.stack}>
              <label className={styles.field}><span>Question blocks</span><textarea className={`${styles.textarea} ${styles.importArea}`} value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder={QUESTION_EXAMPLE} /></label>
              <p className={styles.helper}>Write the question first, then one answer per line as <code>1. Answer - 40</code>. Leave a blank line before the next question.</p>
              <div className={styles.parseStatus}>{parsedQuestions.length ? `${parsedQuestions.length} questions ready to import` : "No valid questions found yet"}</div>
            </div>}
          </div>
        </div>
        {error ? <p className={`${styles.notice} ${styles.error}`}>{error}</p> : null}
        <div className={styles.setupFooter}>
          <p>The game opens in a private manager room. You will receive the player code and broadcast link there.</p>
          <button className={styles.button} disabled={creating} onClick={() => void create()}>{creating ? "Creating match..." : "Create match"}</button>
        </div>
      </section> : null}

      {!showSetup && error ? <p className={`${styles.notice} ${styles.error} ${styles.landingError}`}>{error}</p> : null}
    </main>
  </div>;
}
