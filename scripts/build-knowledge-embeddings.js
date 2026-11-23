const runEmbeddingSync = require("./run-embedding-sync");

runEmbeddingSync("knowledge").catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
