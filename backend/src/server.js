import "dotenv/config";

// Imported after dotenv so config modules see the env vars.
const { default: app } = await import("./app.js");

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API running on port ${port}`));
