import { tokenizer } from "acorn";
import { type Cheerio, type Element, load } from "cheerio";
import MagicString from "magic-string";
import type { PluginOption, ResolvedConfig } from "vite";

type Options = {
  name: string;
};

export default function viteQiankun(opts: Options): PluginOption {
  let config: ResolvedConfig;
  let publicPath =
    '(window.proxy && window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ || "")';
  return [
    {
      name: "qiankun:remain-exports",
      enforce: "post",
      apply: "build",
      options(options) {
        return {
          ...options,
          preserveEntrySignatures: "strict",
        };
      },
      transform(code, id) {
        if (id.endsWith("html") && this.getModuleInfo(id)?.isEntry) {
          return code.replace(/import/g, "export * from");
        }
        return null;
      },
    },
    {
      name: "qiankun:vite-module-script-transform",
      enforce: "post",
      apply: "serve",
      configureServer(server) {
        return () => {
          server.middlewares.use((_, res, next) => {
            if (config.isProduction) return next();

            const end = res.end.bind(res);
            // biome-ignore lint/suspicious/noExplicitAny: <explanation>
            res.end = (...args: any[]) => {
              let [htmlStr, ...rest] = args;
              if (typeof htmlStr === "string") {
                const $ = load(htmlStr);
                moduleScriptToGeneralScript(
                  $($(`script[src=${config.base}@vite/client]`).get(0)),
                  publicPath,
                );
                const moduleScripts$ = $("script:not([src])[type=module]");
                moduleScripts$.each((_, moduleScript) => {
                  const moduleScript$ = $(moduleScript);
                  if (
                    moduleScript$
                      .text()
                      .includes(`${config.base}@react-refresh`)
                  ) {
                    reactRefreshModuleScriptToGeneralScript(
                      moduleScript$,
                      `${publicPath} + "${config.base}@react-refresh"`,
                    );
                  }
                });
                htmlStr = $.html();
              }
              return end(htmlStr, ...rest);
            };
            next();
          });
        };
      },
    },
    {
      name: "qiankun:support-proxy",
      enforce: "post",
      transform(code, id) {
        const filename = id.split("?")[0];
        const jsExts = [
          /\.[jt]sx?$/,
          /\.(m)?js?$/,
          /\.vue$/,
          /\.vue\?vue/,
          /\.svelte$/,
        ];
        if (
          filename.includes("node_modules/vite/dist/client/env.mjs") ||
          !jsExts.some((reg) => reg.test(id)) ||
          !/(document|window|globalThis|self)/g.test(code)
        )
          return code;

        const varMap = {
          document: "__QIANKUN_WINDOW__.document",
          window: "__QIANKUN_WINDOW__",
          globalThis: "__QIANKUN_WINDOW__",
          self: "__QIANKUN_WINDOW__",
        };
        for (const varName in varMap) {
          // biome-ignore lint/style/noParameterAssign: <explanation>
          code = convertVariable(
            code,
            varName,
            varMap[varName as keyof typeof varMap],
          );
        }

        return code;
      },
    },
    {
      name: "qiankun:html-transform",
      enforce: "post",
      configResolved(resolvedConfig) {
        config = resolvedConfig;
        if (config.base) {
          publicPath = `${publicPath}.replace(${new RegExp(
            `${config.base}$`,
          )}, "")`;
        }
      },
      transformIndexHtml(html: string) {
        const $ = load(html);
        const moduleTags = $(
          'body script[src][type=module], head script[src][crossorigin=""]',
        );
        if (!moduleTags || !moduleTags.length) {
          return;
        }
        moduleTags.each(
          (_, moduleTag) =>
            void moduleScriptToGeneralScript($(moduleTag), publicPath),
        );

        const script$ = moduleTags.last();
        script$?.html(`
      const nativeGlobal = Function("return this")();
      nativeGlobal.__QIANKUN_WINDOW__ = (typeof window !== "undefined" ? (window.proxy || window) : {});
      window["${opts.name}"] = {};
      const lifecycleNames = ["bootstrap", "mount", "unmount", "update"];
      ${script$.html()}.then((lifecycleHooks) => {
        lifecycleNames.forEach((lifecycleName) =>
          window["${opts.name}"][lifecycleName].resolve(
            lifecycleHooks[lifecycleName],
          ),
        );
      });
      lifecycleNames.forEach((lifecycleName) => {
        let resolve;
        const promise = new Promise((_resolve) => (resolve = _resolve));
        window["${opts.name}"][lifecycleName] = Object.assign(
          (...args) => promise.then((lifecycleHook) => lifecycleHook(...args)),
          { resolve },
        );
      });
    `);
        return $.html();
      },
    },
  ];
}

declare module "acorn" {
  interface Token {
    value?: string;
  }
}

function convertVariable(code: string, from: string, to: string) {
  const s = new MagicString(code);
  const tokens = tokenizer(code, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowHashBang: true,
    allowAwaitOutsideFunction: true,
    allowImportExportEverywhere: true,
  });
  for (const token of tokens) {
    if (token.value === from && ![".", '"', "'"].includes(code[token.start])) {
      s.overwrite(token.start, token.end, to);
    }
  }
  return s.toString();
}

function moduleScriptToGeneralScript(
  script$: Cheerio<Element>,
  publicPath: string,
) {
  const scriptSrc = script$.attr("src");
  if (!scriptSrc) return;
  script$
    .removeAttr("src")
    .removeAttr("type")
    .html(`import(${publicPath} + "${scriptSrc}")`);
  return script$;
}

function reactRefreshModuleScriptToGeneralScript(
  script$: Cheerio<Element>,
  reactRefreshImportPath: string,
) {
  script$
    .removeAttr("type")
    .empty()
    .html(`
    ((window) => {
      import(${reactRefreshImportPath}).then(({ default: RefreshRuntime }) => {
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
      });
    })(new Function("return this")());
  `);
  return script$;
}
