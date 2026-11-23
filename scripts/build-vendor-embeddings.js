const runEmbeddingSync = require("./run-embedding-sync");

runEmbeddingSync("vendors").catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
