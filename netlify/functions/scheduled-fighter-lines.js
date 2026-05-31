const fighterLines = require("./refresh-fighter-lines.js");

exports.config = {
  schedule: "0 12 * * *"
};

exports.handler = async function() {
  return fighterLines.refreshAndSaveToFirebase();
};
