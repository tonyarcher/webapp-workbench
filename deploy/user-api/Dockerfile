# user-api runtime. Compile on the host (`npm run build -w user-api` / gradle bootJar),
# then copy the Spring Boot jar. deploy.mjs runs that host build unless --no-build.

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
ENV PORT=3000
COPY apps/user-api/build/libs/user-api-0.1.0.jar /app/app.jar
USER nobody
EXPOSE 3000
CMD ["java", "-jar", "/app/app.jar"]
