import { envConfig } from "./config/index.js";
import { buildApp } from "./app.js";

const app = buildApp();

app.listen({
    port: envConfig.port,
    host: "0.0.0.0",
})
    .then(() => {
        console.log(
            `WorksiteID backend listening on port ${envConfig.port}`,
        );
    })
    .catch((error) => {
        console.error("Failed to start server:", error);
        process.exit(1);
    });