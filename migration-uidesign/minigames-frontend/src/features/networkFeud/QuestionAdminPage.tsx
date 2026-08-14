"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { deactivateFeudQuestion, listFeudQuestions, saveFeudQuestion, type FeudQuestionInput } from "@/lib/familyFeud/api";
import type { FeudQuestionRecord } from "@/lib/familyFeud/types";
import { getNetworkToken, hasNetworkRole, useNetworkSession } from "@/lib/networkSession";
import { FeudLogo } from "./Shared";
import styles from "./network-feud.module.css";

const blankAnswer = () => ({ answer: "", points: 0, aliases: [] as string[] });
const blankQuestion = (): FeudQuestionInput => ({ question: "", category: "GENERAL", pack: "Core Set", active: true, answers: [blankAnswer(), blankAnswer(), blankAnswer(), blankAnswer(), blankAnswer()] });

export function QuestionAdminPage() {
  const { user, token, isHydrated } = useNetworkSession();
  const canManage = Boolean(user && hasNetworkRole(user, "SOCIAL_MEDIA", "ADMIN"));
  const [questions, setQuestions] = useState<FeudQuestionRecord[]>([]);
  const [draft, setDraft] = useState<FeudQuestionInput>(blankQuestion);
  const [editingId, setEditingId] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    try { setQuestions(await listFeudQuestions(getNetworkToken())); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Questions could not be loaded."); }
  };
  useEffect(() => { if (isHydrated && canManage) void refresh(); }, [isHydrated, canManage]);

  const edit = (question: FeudQuestionRecord) => {
    setEditingId(question.id);
    setDraft({ question: question.question, category: question.category, pack: question.pack, active: question.active, answers: question.answers.map((answer) => ({ answer: answer.answer, points: answer.points, aliases: answer.aliases })) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (!token) return;
    setBusy(true); setMessage(null);
    try {
      await saveFeudQuestion(token, { ...draft, answers: draft.answers.filter((answer) => answer.answer.trim()) }, editingId);
      setDraft(blankQuestion()); setEditingId(undefined); setMessage(editingId ? "Question updated." : "Question added to the library."); await refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Question could not be saved."); }
    finally { setBusy(false); }
  };

  if (isHydrated && !user) return <div className={styles.shell}><div className={styles.centerState}><div><FeudLogo /><h1 className={styles.phaseHero}>Sign in required</h1><p className={styles.sectionCopy}>Question administration uses your existing Network account.</p><Link className={styles.button} style={{ display: "inline-grid", placeItems: "center", marginTop: 18 }} href="/login">Sign in</Link></div></div></div>;
  if (isHydrated && user && !canManage) return <div className={styles.shell}><div className={styles.centerState}><div><FeudLogo /><h1 className={styles.phaseHero}>Social Media access required</h1><p className={styles.sectionCopy}>Family Feud questions are managed by members with the Social Media or Admin role.</p><Link className={styles.button} style={{ marginTop: 18 }} href="/feud">Back to Family Feud</Link></div></div></div>;

  return <div className={styles.shell}>
    <div className={`${styles.container} ${styles.wide}`}>
      <div className={styles.topline}><div><FeudLogo /><p className={styles.eyebrow} style={{ marginTop: 16 }}>Game questions</p><h1 className={styles.title} style={{ fontSize: "clamp(42px, 6vw, 72px)" }}>Question library</h1></div><Link className={`${styles.button} ${styles.buttonSecondary}`} style={{ display: "inline-grid", placeItems: "center" }} href="/feud">Back to Family Feud</Link></div>
      {message ? <p className={styles.notice} style={{ marginBottom: 18 }}>{message}</p> : null}
      <div className={styles.managerGrid}>
        <section className={`${styles.card} ${styles.cardPad}`}>
          <h2 className={styles.sectionTitle}>{editingId ? "Edit survey question" : "Create survey question"}</h2>
          <p className={styles.sectionCopy}>Answers are ranked in the order shown. Aliases are manager-only and support automatic match suggestions.</p>
          <div className={styles.stack} style={{ marginTop: 20 }}>
            <label className={styles.field}><span>Question</span><textarea className={styles.textarea} value={draft.question} onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))} placeholder="Name something people do when they cannot sleep." /></label>
            <div className={styles.grid2}><label className={styles.field}><span>Category</span><select className={styles.select} value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>{["GENERAL", "GAMING", "OVERWATCH", "MEMES", "COMMUNITY", "WORK", "CUSTOM"].map((category) => <option key={category}>{category}</option>)}</select></label><label className={styles.field}><span>Question pack</span><input className={styles.input} value={draft.pack} onChange={(event) => setDraft((current) => ({ ...current, pack: event.target.value }))} /></label></div>
            <p className={styles.controlTitle}>Survey answers</p>
            {draft.answers.map((answer, index) => <div className={styles.answerEditor} key={index}>
              <input className={styles.input} value={answer.answer} onChange={(event) => setDraft((current) => ({ ...current, answers: current.answers.map((item, answerIndex) => answerIndex === index ? { ...item, answer: event.target.value } : item) }))} placeholder={`#${index + 1} answer`} />
              <input className={styles.input} type="number" min="0" max="100" value={answer.points} onChange={(event) => setDraft((current) => ({ ...current, answers: current.answers.map((item, answerIndex) => answerIndex === index ? { ...item, points: Number(event.target.value) } : item) }))} aria-label={`Answer ${index + 1} points`} />
              <input className={styles.input} value={answer.aliases.join(", ")} onChange={(event) => setDraft((current) => ({ ...current, answers: current.answers.map((item, answerIndex) => answerIndex === index ? { ...item, aliases: event.target.value.split(",").map((alias) => alias.trim()).filter(Boolean) } : item) }))} placeholder="Aliases, comma separated" />
              <button className={`${styles.button} ${styles.buttonDanger}`} disabled={draft.answers.length <= 2} onClick={() => setDraft((current) => ({ ...current, answers: current.answers.filter((_, answerIndex) => answerIndex !== index) }))}>×</button>
            </div>)}
            <div className={styles.buttonRow}><button className={`${styles.button} ${styles.buttonSecondary}`} disabled={draft.answers.length >= 10} onClick={() => setDraft((current) => ({ ...current, answers: [...current.answers, blankAnswer()] }))}>Add answer</button><button className={styles.button} disabled={busy || !draft.question.trim()} onClick={() => void save()}>{busy ? "Saving…" : editingId ? "Save changes" : "Create question"}</button>{editingId ? <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => { setEditingId(undefined); setDraft(blankQuestion()); }}>Cancel</button> : null}</div>
          </div>
        </section>
        <aside className={`${styles.card} ${styles.cardPad}`}><div className={styles.topline}><div><h2 className={styles.sectionTitle}>Saved questions</h2><p className={styles.sectionCopy}>{questions.filter((question) => question.active).length} active · {questions.length} total</p></div></div><div className={styles.questionList}>{questions.map((question) => <article className={styles.questionItem} key={question.id}><div className={styles.buttonRow} style={{ justifyContent: "space-between" }}><span className={styles.pill}>{question.category} · {question.pack}</span>{!question.active ? <span className={styles.pill}>Inactive</span> : null}</div><h3>{question.question}</h3><p className={styles.tiny}>{question.answers.map((answer) => `${answer.rank}. ${answer.answer} (${answer.points})`).join(" · ")}</p><div className={styles.buttonRow} style={{ marginTop: 12 }}><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={() => edit(question)}>Edit</button>{question.active ? <button className={`${styles.button} ${styles.buttonDanger}`} onClick={async () => { if (!token) return; await deactivateFeudQuestion(token, question.id); await refresh(); }}>Deactivate</button> : null}</div></article>)}</div></aside>
      </div>
    </div>
  </div>;
}
