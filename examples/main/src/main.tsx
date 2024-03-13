import {
  registerMicroApps,
  runAfterFirstMounted,
  setDefaultMountApp,
  start,
} from "qiankun";
import React from "react";
import ReactDOM from "react-dom/client";
import { name } from "../package.json";
import App from "./App.tsx";
import type { RootProps } from "./types.ts";

import "./index.css";

// biome-ignore lint/style/noNonNullAssertion: <explanation>
const container = document.getElementById("main-app")!;
const root = ReactDOM.createRoot(container);

const render = (props: RootProps) =>
  root.render(
    <React.StrictMode>
      <App {...props} />
    </React.StrictMode>,
  );

render({ loading: false });

const loader = (loading: boolean) => render({ loading });

registerMicroApps(
  [
    {
      name: "react-app",
      entry: "http://localhost:8001",
      container: "#sub-app",
      activeRule: "/react",
      loader,
    },
    {
      name: "vue-app",
      entry: "http://localhost:8002",
      container: "#sub-app",
      activeRule: "/vue",
      loader,
    },
    {
      name: "svelte-app",
      entry: "http://localhost:8003",
      container: "#sub-app",
      activeRule: "/svelte",
      loader,
    },
  ],
  {
    beforeLoad: [
      async (app) => {
        console.log("[LifeCycle] before load %c%s", "color: green;", app.name);
      },
    ],
    beforeMount: [
      async (app) => {
        console.log("[LifeCycle] before mount %c%s", "color: green;", app.name);
      },
    ],
    afterUnmount: [
      async (app) => {
        console.log(
          "[LifeCycle] after unmount %c%s",
          "color: green;",
          app.name,
        );
      },
    ],
  },
);

setDefaultMountApp("/react");

start({ sandbox: import.meta.env.SANDBOX });

runAfterFirstMounted(() => {
  console.log(`[${name}] first app mounted`);
});
