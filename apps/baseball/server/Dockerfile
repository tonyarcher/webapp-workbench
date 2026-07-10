FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY server/build/libs/server.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
