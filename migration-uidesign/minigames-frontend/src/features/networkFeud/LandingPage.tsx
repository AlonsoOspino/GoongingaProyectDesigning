"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { createFeudGame, importFeudQuestions, listFeudQuestions } from "@/lib/familyFeud/api";
import { parseSurveyQuestionBlocks } from "@/lib/familyFeud/surveyImport";
import { hasNetworkRole, useNetworkSession } from "@/lib/networkSession";
import { FeudLogo } from "./Shared";
import styles from "./network-feud.module.css";

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
  const canHost = Boolean(user && hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN"));
  const [showSetup, setShowSetup] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("Friday Game Night");
  const [teamAlphaName, setTeamAlphaName] = useState("Team 1");
  const [teamBetaName, setTeamBetaName] = useState("Team 2");
  const [roundCount, setRoundCount] = useState(4);
  const [answerSeconds, setAnswerSeconds] = useState(20);
  const [questionMode, setQuestionMode] = useState<"library" | "paste">("library");
  const [pack, setPack] = useState("Family Feud Starter");
  const [availablePacks, setAvailablePacks] = useState<Array<{ name: string; count: number }>>([]);
  const [questionText, setQuestionText] = useState("");
  const parsedQuestions = useMemo(() => parseSurveyQuestionBlocks(questionText, 10), [questionText]);

  const onQuestionModeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextMode = event.key === "Home" ? "library" : event.key === "End" ? "paste" : questionMode === "library" ? "paste" : "library";
    setQuestionMode(nextMode);
    window.requestAnimationFrame(() => document.getElementById(`question-tab-${nextMode}`)?.focus());
  };

  useEffect(() => {
    if (!token || !canHost) return;
    listFeudQuestions(token).then((questions) => {
      const counts = new Map<string, number>();
      for (const question of questions.filter((item) => item.active)) counts.set(question.pack, (counts.get(question.pack) || 0) + 1);
      setAvailablePacks([...counts].map(([name, count]) => ({ name, count })));
    }).catch(() => undefined);
  }, [token, canHost]);

  const openSetup = () => {
    if (!user) return router.push("/login?next=/feud");
    if (!canHost) return setError("Only members with the Social Media or Admin role can create a Family Feud game. Captains enter through the private link sent by the manager.");
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

  return <div className={`${styles.shell} ${styles.feudHomeShell}`}>
    <main className={`${styles.container} ${styles.landing}`}>
      <header className={`${styles.pageIntro} ${styles.landingHero}`}>
        <div className={styles.landingHeroCopy}>
          <FeudLogo />
          <h1 className={styles.landingTitle}>Family Feud</h1>
          <p className={styles.subhead}>One link for players. One control room for the host. One stable program output for OBS.</p>
        </div>
        <div className={styles.landingBoard} aria-hidden="true">
          <span><b>1</b></span><span><b>2</b></span><span><b>3</b></span><span><b>4</b></span>
        </div>
      </header>

      <div className={styles.entryGrid}>
        <section className={`${styles.card} ${styles.cardPad} ${styles.entryCard}`}>
          <span className={styles.stepNumber}>1</span>
          <div><h2 className={styles.sectionTitle}>Player Join</h2><p className={styles.sectionCopy}>Players enter from the private team invitation. There is no minigame dashboard to learn.</p></div>
          <div className={styles.captainNote}>If you are playing, ask the host for your private team link.</div>
        </section>

        <section className={`${styles.card} ${styles.cardPad} ${styles.entryCard}`}>
          <span className={styles.stepNumber}>2</span>
          <div>
            <h2 className={styles.sectionTitle}>Host Control</h2>
            <p className={styles.sectionCopy}>The manager sees the live state, connected players, answers, scores, and exactly what the program is showing.</p>
          </div>
          <div className={styles.buttonRow}><button className={styles.button} disabled={!isHydrated || Boolean(user && !canHost)} onClick={openSetup}>{canHost ? "Create Family Feud" : user ? "Social Media access required" : "Sign in as host"}</button>{canHost ? <Link className={`${styles.button} ${styles.buttonSecondary}`} href="/admin/feud/games">Manage existing shows</Link> : null}</div>
        </section>

        <section className={`${styles.card} ${styles.cardPad} ${styles.entryCard}`}>
          <span className={styles.stepNumber}>3</span>
          <div><h2 className={styles.sectionTitle}>Broadcast / OBS</h2><p className={styles.sectionCopy}>A clean 16:9 program frame holds the last confirmed board while the connection recovers.</p></div>
          <div className={styles.captainNote}>The host copies the OBS browser-source link from the control room.</div>
        </section>
      </div>

      {showSetup ? <section className={`${styles.card} ${styles.setupPanel}`}>
        <div className={styles.setupHeading}>
          <div><h2>Family Feud details</h2></div>
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
            <div className={styles.modeTabs} role="tablist" aria-label="Question source" onKeyDown={onQuestionModeKeyDown}>
              <button id="question-tab-library" role="tab" aria-selected={questionMode === "library"} aria-controls="question-panel-library" tabIndex={questionMode === "library" ? 0 : -1} className={questionMode === "library" ? styles.activeTab : ""} onClick={() => setQuestionMode("library")} type="button">Use saved questions</button>
              <button id="question-tab-paste" role="tab" aria-selected={questionMode === "paste"} aria-controls="question-panel-paste" tabIndex={questionMode === "paste" ? 0 : -1} className={questionMode === "paste" ? styles.activeTab : ""} onClick={() => setQuestionMode("paste")} type="button">Paste new questions</button>
            </div>
            {questionMode === "library" ? <div id="question-panel-library" role="tabpanel" aria-labelledby="question-tab-library" tabIndex={0} className={styles.stack}>
              <label className={styles.field}><span>Question pack</span><select className={styles.select} value={pack} onChange={(event) => setPack(event.target.value)}>{availablePacks.length ? availablePacks.map((item) => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>) : <option value="Family Feud Starter">Family Feud Starter</option>}</select></label>
              <p className={styles.helper}>Questions are selected automatically from this pack when each round starts.</p>
              <Link className={styles.inlineLink} href="/admin/feud/questions">Open the full question library</Link>
            </div> : <div id="question-panel-paste" role="tabpanel" aria-labelledby="question-tab-paste" tabIndex={0} className={styles.stack}>
              <label className={styles.field}><span>Question blocks</span><textarea className={`${styles.textarea} ${styles.importArea}`} value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder={QUESTION_EXAMPLE} /></label>
              <p className={styles.helper}>Write the question first, then one answer per line as <code>1. Answer - 40</code>. Leave a blank line before the next question.</p>
              <div className={styles.parseStatus}>{parsedQuestions.length ? `${parsedQuestions.length} questions ready to import` : "No valid questions found yet"}</div>
            </div>}
          </div>
        </div>
        {error ? <p className={`${styles.notice} ${styles.error}`}>{error}</p> : null}
        <div className={styles.setupFooter}>
          <p>The game opens in a private manager room with one invitation link for each captain and a separate broadcast link.</p>
          <button className={styles.button} disabled={creating} onClick={() => void create()}>{creating ? "Creating match..." : "Create match"}</button>
        </div>
      </section> : null}

      {!showSetup && error ? <p className={`${styles.notice} ${styles.error} ${styles.landingError}`}>{error}</p> : null}
    </main>
  </div>;
}
