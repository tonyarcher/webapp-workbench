# calendar-sync-api runtime. Compile on the host (`gradle bootJar`), then copy
# the Spring Boot jar. deploy runs that host build unless --no-build.

FROM eclipse-temurin:26-jre-noble
WORKDIR /app
ENV PORT=3000
COPY apps/calendar-sync/api/build/libs/calendar-sync-api-0.1.0.jar /app/app.jar
USER nobody
EXPOSE 3000
CMD ["java", "-jar", "/app/app.jar"]
