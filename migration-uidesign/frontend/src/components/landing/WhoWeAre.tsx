import styles from "./who-we-are.module.css";
import BrandField from "./atmosphere/BrandField";

export default function WhoWeAre() {
  return (
    <section className={styles.section} id="who-we-are" aria-labelledby="who-we-are-title">
      <BrandField variant="section" className={styles.field} intensity={1} ground={false} motion="calm" seedOffset={50} />
      <div className={styles.inner}>
        <div className={styles.visual}>
          <img
            className={styles.image}
            src="/who-we-are.webp"
            alt="Freja aiming her crossbow in Overwatch."
            width={1920}
            height={1080}
            loading="lazy"
          />
        </div>
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
