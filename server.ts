import express from "express";

const app = express();
const PORT = process.env.PORT || 3008;

// Health check endpoint
app.get("/", (_req, res) => {
	res.send("Worker is running!");
});

// Start the worker
import("./dist/worker").catch(() => import("./src/worker"));

app.listen(PORT, () => {
	console.log(`Express server listening on port ${PORT}`);
});
