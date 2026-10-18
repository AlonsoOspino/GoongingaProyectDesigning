import TwitchClips from "./TwitchClips";
import styles from "./who-we-are.module.css";

export default function WhoWeAre() {
  return (
    <section className={styles.section} id="who-we-are" aria-labelledby="who-we-are-title">
      <div className={styles.inner}>
        <TwitchClips />
        <div className={styles.copy}>
          <h2 className={styles.title} id="who-we-are-title">WHO WE ARE?</h2>
          <p className={styles.body}>
            Overtime Productions is a group of friends that started with custom game nights in 2022.
          </p>
          <p className={styles.body}>
            Since then, we’ve grown into organized tournaments and events.
            The community has stayed part of it all, playing together and joining in.
          </p>
        </div>
      </div>
    </section>
  );
}
