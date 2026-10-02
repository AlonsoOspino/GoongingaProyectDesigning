FROM maven:3.9.16-eclipse-temurin-21 AS build
WORKDIR /source
COPY backend-springboot/pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY backend-springboot/src ./src
RUN mvn -B -q -DskipTests package

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /source/target/backend-springboot-0.0.1-SNAPSHOT.jar /app/backend.jar
COPY migration-uidesign/frontend/MapImages /app/assets/maps
COPY migration-uidesign/frontend/HeroImages /app/assets/heroes
COPY migration-uidesign/backend/assets/VSPARATEAM.jpg /app/assets/VSPARATEAM.jpg
RUN mkdir -p /app/uploads && chown -R 10001:10001 /app
ENV PORT=3000 \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -Djava.awt.headless=true" \
    MEDIA_DIR=/app/uploads \
    MAP_ASSET_DIR=/app/assets/maps \
    HERO_ASSET_DIR=/app/assets/heroes \
    VS_BACKGROUND_PATH=/app/assets/VSPARATEAM.jpg
USER 10001:10001
EXPOSE 3000
ENTRYPOINT ["java","-jar","/app/backend.jar"]
