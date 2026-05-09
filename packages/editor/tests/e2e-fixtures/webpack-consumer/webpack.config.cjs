const path = require("node:path");

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "entry.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    library: { type: "module" },
    clean: true,
  },
  experiments: { outputModule: true },
  resolve: { extensions: [".js", ".mjs"] },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["null-loader"],
      },
    ],
  },
  performance: { hints: false },
};
