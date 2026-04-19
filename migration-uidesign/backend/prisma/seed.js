const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require("bcrypt");

const heroIconFiles = [
  "Icon-Ana.webp",
  "Icon-Anran.webp",
  "Icon-Ashe.webp",
  "Icon-Baptiste.webp",
  "Icon-Bastion.webp",
  "Icon-Brigitte.webp",
  "Icon-Cassidy.webp",
  "Icon-D.Va.webp",
  "Icon-Domina.webp",
  "Icon-Doomfist.webp",
  "Icon-Echo.webp",
  "Icon-Emre.webp",
  "Icon-Freja.webp",
  "Icon-Genji.webp",
  "Icon-Hanzo.webp",
  "Icon-Hazard.webp",
  "Icon-Illari.webp",
  "Icon-Jetpack_Cat.webp",
  "Icon-Junker_Queen.webp",
  "Icon-Junkrat.webp",
  "Icon-Juno.webp",
  "Icon-kiriko.webp",
  "Icon-Lifeweaver.webp",
  "Icon-Lucio.webp",
  "Icon-Mauga.webp",
  "Icon-Mei.webp",
  "Icon-Mercy.webp",
  "Icon-Mizuki.webp",
  "Icon-Moira.webp",
  "Icon-Orisa.webp",
  "Icon-Pharah.webp",
  "Icon-Ramattra.webp",
  "Icon-Reaper.webp",
  "Icon-Reinhardt.webp",
  "Icon-Roadhog.webp",
  "Icon-Sigma.webp",
  "Icon-Sojourn.webp",
  "Icon-Soldier_76.webp",
  "Icon-Sombra.webp",
  "Icon-Symmetra.webp",
  "Icon-Torbj%3Frn.webp",
  "Icon-Tracer.webp",
  "Icon-Vendetta.webp",
  "Icon-Venture.webp",
  "Icon-Widowmaker.webp",
  "Icon-Winston.webp",
  "Icon-Wrecking_Ball.webp",
  "Icon-Wuyang.webp",
  "Icon-Zarya.webp",
  "Icon-Zenyatta.webp",
];

const mapImageFiles = [
  "Atlis_Flashpoint.webp",
  "Blizzard_World_Hybrid.jpg",
  "Busan_Control.webp",
  "Circuit_Royale_Playload.png",
  "Colosseo_Push.jpg",
  "Dorado_Playload.jpg",
  "EichenWalde_Hybrid.jpg",
  "Esperanca_Push.jpg",
  "Gibraltar_Playload.webp",
  "Havana_Playload.webp",
  "Hollywood_Hybrid.avif",
  "Ilios_Control.webp",
  "Junkertown_Playload.webp",
  "Kingsrow_Hybrid.webp",
  "Lijiang_Tower_Control.webp",
  "Midtown_Hybrid.jpg",
  "Nepal_Control.webp",
  "New_Junk_City_Flashpoint.webp",
  "New_Queen_Street_Push.jpg",
  "Numbani_Hybrid.jpg",
  "Oasis_Control.jpg",
  "Paraiso_Hybrid.webp",
  "Rialto_Playload.webp",
  "Route66_Playload.webp",
  "Runasapi_Push.webp",
  "Samoa_Control.webp",
  "Shambali_Playload.jpg",
  "Survasa_Flashpoint.jpg",
];

const heroRoleByName = {
  ANA: "SUPPORT",
  ASHE: "DPS",
  BAPTISTE: "SUPPORT",
  BASTION: "DPS",
  BRIGITTE: "SUPPORT",
  CASSIDY: "DPS",
  DVA: "TANK",
  DOOMFIST: "TANK",
  ECHO: "DPS",
  GENJI: "DPS",
  HANZO: "DPS",
  HAZARD: "TANK",
  ILLARI: "SUPPORT",
  JUNKERQUEEN: "TANK",
  JUNKRAT: "DPS",
  JUNO: "SUPPORT",
  KIRIKO: "SUPPORT",
  LIFEWEAVER: "SUPPORT",
  LUCIO: "SUPPORT",
  MAUGA: "TANK",
  MEI: "DPS",
  MERCY: "SUPPORT",
  MOIRA: "SUPPORT",
  ORISA: "TANK",
  PHARAH: "DPS",
  RAMATTRA: "TANK",
  REAPER: "DPS",
  REINHARDT: "TANK",
  ROADHOG: "TANK",
  SIGMA: "TANK",
  SOJOURN: "DPS",
  SOLDIER76: "DPS",
  SOMBRA: "DPS",
  SYMMETRA: "DPS",
  TORBJORN: "DPS",
  TRACER: "DPS",
  VENTURE: "DPS",
  WIDOWMAKER: "DPS",
  WINSTON: "TANK",
  WRECKINGBALL: "TANK",
  ZARYA: "TANK",
  ZENYATTA: "SUPPORT",
};

const heroDisplayNameByKey = {
  DVA: "D.Va",
  JUNKERQUEEN: "Junker Queen",
  SOLDIER76: "Soldier: 76",
  TORBJORN: "Torbjorn",
  WRECKINGBALL: "Wrecking Ball",
};

const normalizeHeroKey = (name) =>
  name
    .replace(/%3F/gi, "o")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const parseHeroName = (file) =>
  file
    .replace(/^Icon-/i, "")
    .replace(/\.[^.]+$/, "")
    .replace(/%3F/gi, "o")
    .replace(/_/g, " ");

const resolveHeroDisplayName = (parsedName) => {
  const key = normalizeHeroKey(parsedName);
  return heroDisplayNameByKey[key] || parsedName;
};

const parseMapType = (fileBase) => {
  const rawType = fileBase.split("_").pop().toUpperCase();
  if (rawType === "PLAYLOAD") return "PAYLOAD";
  return rawType;
};

async function main() {
  console.log("Seeding database with provided HeroImages and MapImages...");
  const passwordHash = await bcrypt.hash("123456", 10);

  // Make seeding repeatable in local development.
  await prisma.playerStat.deleteMany();
  await prisma.draftAction.deleteMany();
  await prisma.draftTable.deleteMany();
  await prisma.match.deleteMany();
  await prisma.member.deleteMany();
  await prisma.team.deleteMany();
  await prisma.map.deleteMany();
  await prisma.hero.deleteMany();
  await prisma.tournament.deleteMany();

  const tournament = await prisma.tournament.create({
    data: {
      name: "Overwatch Tournament Demo",
      startDate: new Date(),
      state: "SCHEDULED",
    },
  });

  const createdMaps = [];
  for (const file of mapImageFiles) {
    const base = file.replace(/\.[^.]+$/, "");
    const type = parseMapType(base);
    const mapName = base
      .split("_")
      .slice(0, -1)
      .join(" ");

    createdMaps.push(
      await prisma.map.create({
        data: {
          type,
          description: mapName,
          imgPath: `/MapImages/${file}`,
        },
      })
    );
  }

  for (const file of heroIconFiles) {
    const parsedName = parseHeroName(file);
    const key = normalizeHeroKey(parsedName);
    const role = heroRoleByName[key] || "DPS";
    const name = resolveHeroDisplayName(parsedName);

    await prisma.hero.create({
      data: {
        name,
        role,
        imgPath: `/HeroImages/${file}`,
      },
    });
  }

  const admin = await prisma.member.create({
    data: {
      nickname: "Admin",
      user: "admin",
      passwordHash,
      role: "ADMIN",
      rank: 5000,
    },
  });

  const manager = await prisma.member.create({
    data: {
      nickname: "Manager",
      user: "manager",
      passwordHash,
      role: "MANAGER",
      rank: 5000,
    },
  });

  const teams = [];
  for (let i = 1; i <= 8; i++) {
    teams.push(
      await prisma.team.create({
        data: {
          name: `Team ${i}`,
          tournamentId: tournament.id,
        },
      })
    );
  }

  let playerIndex = 1;
  for (const team of teams) {
    for (let j = 0; j < 4; j++) {
      await prisma.member.create({
        data: {
          nickname: `Player${playerIndex}`,
          user: `user${playerIndex}`,
          passwordHash,
          role: j === 0 ? "CAPTAIN" : "DEFAULT",
          teamId: team.id,
          rank: 2500 + playerIndex,
        },
      });
      playerIndex += 1;
    }
  }

  const matches = [];
  for (let i = 0; i < teams.length; i += 2) {
    matches.push(
      await prisma.match.create({
        data: {
          type: "PLAYOFFS",
          bestOf: 5,
          startDate: new Date(Date.now() + i * 60 * 60 * 1000),
          tournamentId: tournament.id,
          teamAId: teams[i].id,
          teamBId: teams[i + 1].id,
          allowedMaps: {
            connect: createdMaps.map((m) => ({ id: m.id })),
          },
        },
      })
    );
  }

  for (const match of matches) {
    await prisma.draftTable.create({
      data: {
        matchId: match.id,
        currentTurnTeamId: match.teamAId,
        phase: "STARTING",
        bannedHeroes: [],
        pickedMaps: [],
        currentMapId: null,
      },
    });
  }

  console.log("Seed complete.");
  console.log("Login admin/admin with password 123456");
  console.log("Login manager/manager with password 123456");
    await prisma.member.create({
      data: {
        nickname: "Editor",
        user: "editor",
        passwordHash,
        role: "EDITOR",
        rank: 4000,
      },
    });
    console.log("Login editor/editor with password 123456");
  console.log(`Created ${heroIconFiles.length} heroes and ${mapImageFiles.length} maps.`);
  console.log(`Admin id: ${admin.id}, Manager id: ${manager.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });