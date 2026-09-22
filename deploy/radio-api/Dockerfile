# radio-api runtime. Compile on the host (`gradle :radio-api:bootJar`).
# The image copies the boot jar. No npm install.

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
ENV PORT=3000
COPY apps/radio-station/api/build/libs/radio-api-0.1.0.jar /app/app.jar
USER nobody
EXPOSE 3000
CMD ["java", "-jar", "/app/app.jar"]
