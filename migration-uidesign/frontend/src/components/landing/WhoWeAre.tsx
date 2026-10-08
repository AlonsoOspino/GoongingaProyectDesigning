import styles from "./who-we-are.module.css";

/*
 * The introduction the landing never had: who this actually is, before the page
 * starts talking about the league. Sits above the Overtime GGL chapter.
 */
export default function WhoWeAre() {
  return (
    <section className={styles.section} aria-label="Who we are">
      <div className={styles.inner}>
        <h2 className={styles.title}>Run by the community.</h2>
        <p className={styles.body}>
          We’ve been organising tournaments and streams since 2023.
          Players, casters and friends on Discord — the same people who play the games put on the show.
        </p>
      </div>
    </section>
  );
}
