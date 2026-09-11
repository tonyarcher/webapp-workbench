# user-api: Kotlin / Ktor identity service. Listens on 3000.

FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /src
COPY apps/user-api /src
RUN chmod +x gradlew && ./gradlew --no-daemon installDist

FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app
ENV PORT=3000
COPY --from=build /src/build/install/user-api /app
USER nobody
EXPOSE 3000
CMD ["bin/user-api"]
