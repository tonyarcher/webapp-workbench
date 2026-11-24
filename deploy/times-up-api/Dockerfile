# times-up-api runtime. Compile on the host (`npm run build -w times-up-api` / gradle bootJar),
# then copy the Spring Boot jar. gradle buildJvm (deploy runs it) builds that.

FROM eclipse-temurin:26-jre-noble
WORKDIR /app
ENV PORT=3000
COPY apps/times-up/api/build/libs/times-up-api-0.1.0.jar /app/app.jar
USER nobody
EXPOSE 3000
CMD ["java", "-jar", "/app/app.jar"]
