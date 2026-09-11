# fitness-api runtime. JVM bytecode is portable: compile on the host
# (`npm run build -w fitness-api` / gradle installDist), then copy jars.
# deploy.mjs runs that host build before compose unless --no-build.

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
ENV PORT=3000
COPY apps/fitness-api/build/install/fitness-api/lib /app/lib
USER nobody
EXPOSE 3000
CMD ["java", "-cp", "/app/lib/*", "fitnessapi.MainKt"]
