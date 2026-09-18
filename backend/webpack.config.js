const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = function (options, webpack) {
  return {
    ...options,
    plugins: [
      ...(options.plugins || []),
      // Copy Prisma query engine to dist folder
      new CopyPlugin({
        patterns: [
          {
            from: path.resolve(
              __dirname,
              "../../node_modules/.prisma/client/query_engine-windows.dll.node"
            ),
            to: path.resolve(__dirname, "dist/query_engine-windows.dll.node"),
            noErrorOnMissing: true,
          },
          {
            from: path.resolve(
              __dirname,
              "../node_modules/.prisma/client/query_engine-windows.dll.node"
            ),
            to: path.resolve(__dirname, "dist/query_engine-windows.dll.node"),
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    externals: [
      ...(options.externals || []),
      // Externalize optional dependencies of @nestjs/serve-static
      function ({ request }, callback) {
        // Externalize Prisma Client to avoid bundling issues with enums
        if (request === "@prisma/client" || request === ".prisma/client") {
          return callback(null, "commonjs " + request);
        }
        if (request === "@fastify/static" || request === "fastify-static") {
          // Return empty module for optional fastify dependencies
          return callback(null, "commonjs {}");
        }
        callback();
      },
    ],
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve?.alias,
        "@config": path.resolve(__dirname, "src/config"),
        "@common": path.resolve(__dirname, "src/common"),
        "@database": path.resolve(__dirname, "src/database"),
        "@modules": path.resolve(__dirname, "src/modules"),
        "@infrastructure": path.resolve(__dirname, "src/infrastructure"),
        "@shared": path.resolve(__dirname, "../../packages/shared/src"),
      },
    },
  };
};
