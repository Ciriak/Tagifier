require('package-script').spawn([
      {
          command: "npm",
          args: ["install", "-g", "gulp bower electron-prebuilt electron-installer-windows"]
      },
      {
          command: "gulp",
          args: ["prepare-dev-env"]
      }
  ]);
