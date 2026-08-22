import Image from "next/image";

const mapTypes = ["Control", "Push", "Hybrid", "Payload", "Flashpoint"] as const;

export function MapPool() {
  return (
    <section id="map-pool" className="ggl-map" aria-labelledby="ggl-map-title">
      <div className="ggl-shell">
        <div className="ggl-map__stage">
          <figure className="ggl-map__art">
            <Image
              src="/map-pool-1.png"
              alt="Rialto architecture and clouds"
              fill
              sizes="(max-width: 640px) 100vw, 70vw"
            />
          </figure>

          <div className="ggl-map__content">
            <h2 id="ggl-map-title">
              <span>Map</span>
              <em>Pool</em>
            </h2>
            <p>
              During the regular season, the pool changes from week to week so teams prepare
              beyond one familiar set. In Playoffs and Finals, the fixed pool is removed and
              captains may choose any eligible map for the selected type.
            </p>

            <div className="ggl-map__types" aria-labelledby="ggl-map-types-title">
              <h3 id="ggl-map-types-title">Eligible map types</h3>
              <ul>
                {mapTypes.map((mapType) => (
                  <li key={mapType} className={`ggl-map__type ggl-map__type--${mapType.toLowerCase()}`}>
                    <span className="ggl-map__type-icon" aria-hidden="true" />
                    <span className="ggl-map__type-name">{mapType}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="ggl-map__closing">
              Each game starts with a map type, and the map selection is made from the options
              available for that mode.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
