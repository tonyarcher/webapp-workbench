# user-api runtime. JVM bytecode is portable: compile on the host
# (`npm run build -w user-api` / gradle installDist), then copy jars.
# deploy.mjs runs that host build before compose unless --no-build.

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
ENV PORT=3000
COPY apps/user-api/build/install/user-api/lib /app/lib
USER nobody
EXPOSE 3000
CMD ["java", "-cp", "/app/lib/*", "userapi.MainKt"]
