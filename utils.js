function extractModelShortname(modelString) {
  const parts = modelString.split('/');
  return parts[parts.length - 1].replace('.gguf', '');
}

module.exports = {
  extractModelShortname
};