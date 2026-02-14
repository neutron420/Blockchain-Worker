import express from "express";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Health check endpoint
app.get("/", (_req, res) => {
    res.send("Worker is running!");
});

// Start Express FIRST so Render detects the port immediately
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server listening on port ${PORT}`);

    // Start the worker AFTER port is bound
    (async () => {
        try {
            await import("./worker");
            console.log("Worker started successfully");
        } catch (err) {
            console.error("Failed to start worker:", err);
        }
    })();
});