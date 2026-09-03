import styles from "./who-we-are.module.css";

/*
 * The introduction the landing never had: who this actually is, before the page
 * starts talking about the league. Sits above the Overtime GGL chapter.
 */
export default function WhoWeAre() {
  return (
    <section className={styles.section} aria-label="Who we are">
      <div className={styles.inner}>
        <p className={styles.eyebrow}>
          <span className={styles.mark} aria-hidden="true" />
          Overtime Productions
        </p>
        <h2 className={styles.title}>Who we are?</h2>
        <p className={styles.body}>
          Overtime Productions started back in 2023 as a small circle of friends on Discord,
          running mini-tournaments just for the fun of it. It has grown a little at a time ever
          since — one event, one new face after another — into an active community that plays,
          casts and talks together almost every day. Win or lose, most of us stick
          around long after the match ends — that part matters as much as the games.
        </p>
      </div>
    </section>
  );
}
