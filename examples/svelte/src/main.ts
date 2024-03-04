import type { SvelteComponent } from "svelte";
import { name } from "../package.json";
import App from "./App.svelte";
import "./app.css";

let app: SvelteComponent | null = null;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const render = (props: any = {}) => {
  const { container } = props;

  const target: HTMLElement = container
    ? container.querySelector("#app")
    : document.querySelector("#app");

  if (!app) {
    app = new App({
      target,
    });
  }
};

if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

export async function bootstrap() {
  console.log(`${name} bootstrap`);
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export async function mount(props: any) {
  console.log(`${name} mount`, props);
  render(props);
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export async function unmount(props: any) {
  console.log(`${name} unmount`, props);
  if (app) {
    app.$destroy();
    app = null;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export async function update(props: any) {
  console.log(`${name} update`, props);
}

export default app;
